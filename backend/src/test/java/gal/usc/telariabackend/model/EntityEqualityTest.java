package gal.usc.telariabackend.model;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies the JPA-identity {@code equals}/{@code hashCode} contract shared by the
 * persistence entities: two transient instances (null id) are never equal, two instances
 * with the same generated id are equal, and the hash is derived from the id. The generated
 * id has no setter, so it is injected by reflection to simulate a persisted entity.
 */
class EntityEqualityTest {

    private User userA() {
        return new User("ana", "ana@test.com", "encoded", UUID.randomUUID());
    }

    private User userB() {
        return new User("bob", "bob@test.com", "encoded", UUID.randomUUID());
    }

    @Test
    void friendship_equalityFollowsId() {
        User a = userA();
        User b = userB();
        assertJpaIdentitySemantics(new Friendship(a, b), new Friendship(a, b));
    }

    @Test
    void friendRequest_equalityFollowsId() {
        User a = userA();
        User b = userB();
        assertJpaIdentitySemantics(new FriendRequest(a, b), new FriendRequest(a, b));
    }

    @Test
    void pendingMembership_equalityFollowsId() {
        User owner = userA();
        User invitee = userB();
        Trip trip = new Trip("Viaje a Roma", owner);
        assertJpaIdentitySemantics(new Invitation(trip, invitee), new Invitation(trip, invitee));
    }

    @Test
    void pendingMembership_differentSubtypesWithSameIdAreNotEqual() {
        User owner = userA();
        User invitee = userB();
        Trip trip = new Trip("Viaje a Roma", owner);
        UUID sharedId = UUID.randomUUID();
        Invitation invitation = new Invitation(trip, invitee);
        JoinRequest joinRequest = new JoinRequest(trip, invitee);
        setId(invitation, sharedId);
        setId(joinRequest, sharedId);

        assertNotEquals(invitation, joinRequest,
                "an Invitation and a JoinRequest must differ even with the same id (getClass guard)");
    }

    /**
     * Exercises the full identity contract on two distinct, same-type instances.
     */
    private void assertJpaIdentitySemantics(Object first, Object second) {
        // Reflexive, null-safe and type-safe.
        assertEquals(first, first, "an entity must equal itself");
        assertNotEquals(first, null, "an entity is never equal to null");
        assertNotEquals(first, "not an entity", "an entity is never equal to a foreign type");

        // Two transient instances (id == null) are not equal, and hash to 0.
        assertNotEquals(first, second, "two transient entities must not be equal");
        assertEquals(0, first.hashCode(), "a transient entity hashes to 0");

        // Same generated id => equal, with matching id-based hash.
        UUID id = UUID.randomUUID();
        setId(first, id);
        setId(second, id);
        assertEquals(first, second, "entities sharing an id must be equal");
        assertEquals(first.hashCode(), second.hashCode(), "equal entities must share a hash");
        assertNotEquals(0, first.hashCode(), "a persisted entity hashes from its id");

        // Different ids => not equal.
        setId(second, UUID.randomUUID());
        assertNotEquals(first, second, "entities with different ids must not be equal");
    }

    private static void setId(Object entity, UUID id) {
        try {
            Field field = findField(entity.getClass(), "id");
            field.setAccessible(true);
            field.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Could not set id on " + entity.getClass(), e);
        }
    }

    private static Field findField(Class<?> type, String name) throws NoSuchFieldException {
        for (Class<?> c = type; c != null; c = c.getSuperclass()) {
            try {
                return c.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                // walk up to the superclass (the id lives in PendingMembership for its subtypes)
            }
        }
        throw new NoSuchFieldException(name);
    }
}
