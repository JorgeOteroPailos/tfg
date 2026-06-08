package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.TripChatMessage;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.TripChatMessageRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class TripChatService {

    private record UserEmitter(UUID userId, SseEmitter emitter) {}

    private final TripRepository tripRepo;
    private final UserRepository userRepo;
    private final TripChatMessageRepository chatRepo;

    private final ConcurrentHashMap<UUID, CopyOnWriteArrayList<UserEmitter>> emitters =
            new ConcurrentHashMap<>();

    public TripChatService(TripRepository tripRepo, UserRepository userRepo,
                           TripChatMessageRepository chatRepo) {
        this.tripRepo = tripRepo;
        this.userRepo = userRepo;
        this.chatRepo = chatRepo;
    }

    @Transactional(readOnly = true)
    public List<gal.usc.telariabackend.model.dto.TripChatMessage> getHistory(UUID tripId, UUID userId) {
        tripRepo.findByIdAndMembersId(tripId, userId).orElseThrow(NotATripMemberException::new);
        return chatRepo.findByTripIdOrderByTimestampAsc(tripId)
                .stream()
                .map(TripChatMessage::toDto)
                .toList();
    }

    @Transactional
    public gal.usc.telariabackend.model.dto.TripChatMessage sendMessage(UUID tripId, UUID userId, String content) {
        Trip trip = tripRepo.findByIdAndMembersId(tripId, userId).orElseThrow(NotATripMemberException::new);
        User user = userRepo.findById(userId).orElseThrow();

        TripChatMessage entity = new TripChatMessage(trip, user, content);
        chatRepo.save(entity);

        gal.usc.telariabackend.model.dto.TripChatMessage dto = entity.toDto();
        broadcast(tripId, userId, dto);
        return dto;
    }

    @Transactional(readOnly = true)
    public SseEmitter subscribe(UUID tripId, UUID userId) {
        tripRepo.findByIdAndMembersId(tripId, userId).orElseThrow(NotATripMemberException::new);

        SseEmitter emitter = new SseEmitter(0L);
        UserEmitter ue = new UserEmitter(userId, emitter);
        emitters.computeIfAbsent(tripId, k -> new CopyOnWriteArrayList<>()).add(ue);

        Runnable cleanup = () -> {
            CopyOnWriteArrayList<UserEmitter> list = emitters.get(tripId);
            if (list != null) {
                list.remove(ue);
                if (list.isEmpty()) emitters.remove(tripId, list);
            }
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());

        return emitter;
    }

    // Detects dead connections (e.g. NAT timeout, crash) before the next broadcast.
    @Scheduled(fixedDelay = 25_000)
    public void heartbeat() {
        emitters.forEach((tripId, list) ->
            list.removeIf(ue -> {
                try {
                    ue.emitter().send(SseEmitter.event().comment("heartbeat"));
                    return false;
                } catch (IOException | IllegalStateException e) {
                    ue.emitter().completeWithError(e);
                    return true;
                }
            })
        );
    }

    // Broadcasts to all connected members except the sender (who already has the message from the POST response).
    private void broadcast(UUID tripId, UUID senderId, gal.usc.telariabackend.model.dto.TripChatMessage dto) {
        CopyOnWriteArrayList<UserEmitter> list = emitters.get(tripId);
        if (list == null || list.isEmpty()) return;

        for (UserEmitter ue : list) {
            if (ue.userId().equals(senderId)) continue;
            try {
                ue.emitter().send(SseEmitter.event().name("message").data(dto));
            } catch (IOException | IllegalStateException e) {
                ue.emitter().completeWithError(e);
                list.remove(ue);
            }
        }
    }
}
