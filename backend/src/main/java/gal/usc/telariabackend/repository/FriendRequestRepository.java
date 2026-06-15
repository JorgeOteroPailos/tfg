package gal.usc.telariabackend.repository;

import gal.usc.telariabackend.model.FriendRequest;
import gal.usc.telariabackend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, UUID> {
    List<FriendRequest> findByReceiverId(UUID receiverId);

    boolean existsBySenderAndReceiver(User sender, User receiver);

    @Transactional
    @Modifying
    @Query("DELETE FROM FriendRequest r WHERE r.sender.id = :userId OR r.receiver.id = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);
}
