package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Expense;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.CreateExpenseRequest;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.ExpenseRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ExpenseService {
    private final TripRepository tripRepo;
    private final UserRepository userRepo;
    private final ExpenseRepository expenseRepo;

    public ExpenseService(TripRepository tripRepo, UserRepository userRepo, ExpenseRepository expenseRepo) {
        this.tripRepo = tripRepo;
        this.userRepo=userRepo;
        this.expenseRepo = expenseRepo;
    }

    public UUID createExpense(UUID tripId, UUID creatorId, CreateExpenseRequest request) {
        User creator = userRepo.findById(creatorId).orElseThrow();

        Trip t =tripRepo.findByIdAndMembersContaining(tripId, creator)
                .orElseThrow(() -> new NotATripMemberException("User is not a member of this trip"));

        Set<UUID> memberIds = t.getMembers().stream()
                .map(User::getId)
                .collect(Collectors.toSet());

        User payer= userRepo.findById(request.getPayerId()).orElseThrow(() -> new NotATripMemberException("Payer is not a member of this trip"));
        t.assertIsMember(payer);

        if (!memberIds.containsAll(request.getBeneficiaryIds())) {
            throw new NotATripMemberException("Some beneficiarie is not a trip member");
        }
        Set<User> beneficiaries = request.getBeneficiaryIds().stream()
                .map(userRepo::getReferenceById)
                .collect(Collectors.toSet());

        Expense e=new Expense(t,
                payer,
                BigDecimal.valueOf(request.getAmount()),
                request.getDescription(),
                LocalDateTime.now(),
                creator,
                beneficiaries);
        expenseRepo.save(e);
        return e.getId();
    }
}
