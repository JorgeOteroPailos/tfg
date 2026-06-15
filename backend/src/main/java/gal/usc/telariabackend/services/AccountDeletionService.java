package gal.usc.telariabackend.services;

import gal.usc.telariabackend.configuration.MinioConfig;
import gal.usc.telariabackend.model.Expense;
import gal.usc.telariabackend.model.Settlement;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.repository.AiChatMessageRepository;
import gal.usc.telariabackend.repository.ExpenseRepository;
import gal.usc.telariabackend.repository.FriendRequestRepository;
import gal.usc.telariabackend.repository.FriendshipRepository;
import gal.usc.telariabackend.repository.InvitationRepository;
import gal.usc.telariabackend.repository.JoinRequestRepository;
import gal.usc.telariabackend.repository.RefreshTokenRepository;
import gal.usc.telariabackend.repository.SettlementRepository;
import gal.usc.telariabackend.repository.TripChatMessageRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

import java.util.List;
import java.util.UUID;

/**
 * Handles permanent deletion of a user account and every piece of data tied to it.
 *
 * <p>For trips shared with other members the deleting user's footprint is wiped (their
 * expenses, settlements, chat messages and uploaded documents) while the trip survives for
 * the rest of the members. Trips left empty are deleted entirely, reusing
 * {@link MembershipService#leaveTrip}.
 */
@Service
public class AccountDeletionService {

    private static final Logger log = LoggerFactory.getLogger(AccountDeletionService.class);

    private final UserRepository userRepository;
    private final TripRepository tripRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final TripChatMessageRepository tripChatMessageRepository;
    private final AiChatMessageRepository aiChatMessageRepository;
    private final FriendshipRepository friendshipRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final InvitationRepository invitationRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SharedDocumentService sharedDocumentService;
    private final MembershipService membershipService;
    private final PasswordEncoder passwordEncoder;
    private final S3Client s3Client;
    private final MinioConfig minioConfig;

    public AccountDeletionService(UserRepository userRepository,
                                  TripRepository tripRepository,
                                  ExpenseRepository expenseRepository,
                                  SettlementRepository settlementRepository,
                                  TripChatMessageRepository tripChatMessageRepository,
                                  AiChatMessageRepository aiChatMessageRepository,
                                  FriendshipRepository friendshipRepository,
                                  FriendRequestRepository friendRequestRepository,
                                  InvitationRepository invitationRepository,
                                  JoinRequestRepository joinRequestRepository,
                                  RefreshTokenRepository refreshTokenRepository,
                                  SharedDocumentService sharedDocumentService,
                                  MembershipService membershipService,
                                  PasswordEncoder passwordEncoder,
                                  S3Client s3Client,
                                  MinioConfig minioConfig) {
        this.userRepository = userRepository;
        this.tripRepository = tripRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.tripChatMessageRepository = tripChatMessageRepository;
        this.aiChatMessageRepository = aiChatMessageRepository;
        this.friendshipRepository = friendshipRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.invitationRepository = invitationRepository;
        this.joinRequestRepository = joinRequestRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.sharedDocumentService = sharedDocumentService;
        this.membershipService = membershipService;
        this.passwordEncoder = passwordEncoder;
        this.s3Client = s3Client;
        this.minioConfig = minioConfig;
    }

    @Transactional
    public void deleteAccount(UUID userId, String rawPassword) {
        User user = userRepository.findById(userId).orElseThrow(IllegalStateException::new);

        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new BadCredentialsException("Password is incorrect");
        }

        // 1. For each trip: if other members remain, wipe the user's expenses/settlements so
        //    the trip survives without dangling references; then leave. When the user is the
        //    sole member, leaveTrip deletes the whole trip and its expenses/settlements cascade.
        for (Trip trip : tripRepository.findAllByMembersId(userId)) {
            boolean otherMembersRemain = trip.getMembers().size() > 1;
            if (otherMembersRemain) {
                wipeExpenseFootprint(trip.getId(), user);
                wipeSettlementFootprint(trip.getId(), userId);
            }
            membershipService.leaveTrip(userId, trip.getId());
        }

        // 2. Cross-trip personal data referencing the user.
        tripChatMessageRepository.deleteAllByUserId(userId);
        aiChatMessageRepository.deleteAllByUserId(userId);
        sharedDocumentService.deleteAllForUser(userId);

        friendshipRepository.deleteAll(friendshipRepository.findAllByUserId(userId));
        friendRequestRepository.deleteAllByUserId(userId);
        invitationRepository.deleteAllByUserId(userId);
        joinRequestRepository.deleteAllByUserId(userId);
        refreshTokenRepository.deleteAllByUserId(userId);

        // 3. Avatar objects in Minio (best-effort).
        deleteAvatarObject(user.getAvatarObjectKey(), userId);
        deleteAvatarObject(user.getPendingAvatarObjectKey(), userId);

        // 4. Finally the user itself.
        userRepository.delete(user);
    }

    /**
     * Deletes expenses the user paid or created; for the rest, removes the user from the
     * beneficiary set so other members' records survive without a dangling reference.
     */
    private void wipeExpenseFootprint(UUID tripId, User user) {
        for (Expense expense : expenseRepository.findByTripId(tripId)) {
            boolean ownsExpense = expense.getPayer().getId().equals(user.getId())
                    || expense.getCreator().getId().equals(user.getId());
            if (ownsExpense) {
                expenseRepository.delete(expense);
            } else if (expense.getBeneficiaries().remove(user)) {
                expenseRepository.save(expense);
            }
        }
    }

    private void wipeSettlementFootprint(UUID tripId, UUID userId) {
        for (Settlement settlement : settlementRepository.findByTripId(tripId)) {
            if (settlement.getPayer().getId().equals(userId)
                    || settlement.getReceiver().getId().equals(userId)) {
                settlementRepository.delete(settlement);
            }
        }
    }

    private void deleteAvatarObject(String objectKey, UUID userId) {
        if (objectKey == null) {
            return;
        }
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(minioConfig.getBucket())
                    .key(objectKey)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to delete avatar object '{}' for user {}: {}", objectKey, userId, e.getMessage());
        }
    }
}
