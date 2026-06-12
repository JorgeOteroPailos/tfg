package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Expense;
import gal.usc.telariabackend.model.dto.ExpenseCategory;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.*;
import gal.usc.telariabackend.model.exceptions.ExpenseNotFoundException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.model.Settlement;
import gal.usc.telariabackend.repository.ExpenseRepository;
import gal.usc.telariabackend.repository.SettlementRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ExpenseService {
    private final TripRepository tripRepo;
    private final UserRepository userRepo;
    private final ExpenseRepository expenseRepo;
    private final SettlementRepository settlementRepo;

    public ExpenseService(TripRepository tripRepo, UserRepository userRepo, ExpenseRepository expenseRepo, SettlementRepository settlementRepo) {
        this.tripRepo = tripRepo;
        this.userRepo = userRepo;
        this.expenseRepo = expenseRepo;
        this.settlementRepo = settlementRepo;
    }

    @Transactional
    public UUID createExpense(UUID tripId, UUID creatorId, CreateExpenseRequest request) {
        User creator = userRepo.findById(creatorId).orElseThrow();

        Trip t =tripRepo.findByIdAndMembersContaining(tripId, creator)
                .orElseThrow(NotATripMemberException::new);

        Set<UUID> memberIds = t.getMembers().stream()
                .map(User::getId)
                .collect(Collectors.toSet());

        if (!memberIds.contains(request.getPayerId())) {
            throw new NotATripMemberException("Payer is not a member of this trip");
        }
        User payer = userRepo.getReferenceById(request.getPayerId());

        if (!memberIds.containsAll(request.getBeneficiaryIds())) {
            throw new NotATripMemberException("Some beneficiarie is not a trip member");
        }
        Set<User> beneficiaries = request.getBeneficiaryIds().stream()
                .map(userRepo::getReferenceById)
                .collect(Collectors.toSet());

        ExpenseCategory cat = request.getCategory() != null ? request.getCategory() : ExpenseCategory.GENERAL;

        Expense e=new Expense(t,
                payer,
                BigDecimal.valueOf(request.getAmount()),
                request.getName(),
                creator,
                beneficiaries,
                cat);
        expenseRepo.save(e);
        return e.getId();
    }


    @Transactional
    public void deleteExpense(UUID tripId, UUID expenseId, UUID userId) {
        tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        Expense expense = expenseRepo.findById(expenseId)
                .orElseThrow(ExpenseNotFoundException::new);
        if (!expense.getTrip().getId().equals(tripId)) {
            throw new NotATripMemberException();
        }
        expenseRepo.deleteById(expenseId);
    }

    public BalancesInfo getBalances(UUID tripId, UUID userId){
        Trip t=tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        return calculateBalances(t);
    }

    public List<ExpenseSummary> listExpenses(UUID tripId, UUID userId) {
        Trip t=tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        return t.getExpenses().stream().map(Expense::toExpenseSummary).toList();
    }

    @Transactional
    public UUID createSettlement(UUID tripId, UUID payerId, CreateSettlementRequest request) {
        User payer = userRepo.findById(payerId).orElseThrow();
        Trip trip = tripRepo.findByIdAndMembersContaining(tripId, payer)
                .orElseThrow(NotATripMemberException::new);
        User receiver = userRepo.findById(request.getToId()).orElseThrow();
        Set<UUID> memberIds = trip.getMembers().stream().map(User::getId).collect(Collectors.toSet());
        if (!memberIds.contains(receiver.getId())) {
            throw new NotATripMemberException("Receiver is not a member of this trip");
        }
        Settlement s = new Settlement(trip, payer, receiver, BigDecimal.valueOf(request.getAmount()));
        settlementRepo.save(s);
        return s.getId();
    }

    public List<PastSettlement> listSettlements(UUID tripId, UUID userId) {
        tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        return settlementRepo.findByTrip_IdOrderByTimestampDesc(tripId).stream()
                .map(s -> new PastSettlement()
                        .id(s.getId())
                        .fromId(s.getPayer().getId())
                        .toId(s.getReceiver().getId())
                        .amount(s.getAmount().setScale(2, RoundingMode.HALF_UP).doubleValue())
                        .timestamp(s.getTimestamp()))
                .toList();
    }

    public ExpenseDetail getExpense(UUID tripId, UUID expenseId, UUID userId) {
        if(!tripRepo.existsByIdAndMembersId(tripId, userId)){
            throw new NotATripMemberException();
        }

        return expenseRepo.findByIdAndTripId(expenseId, tripId)
                .orElseThrow(ExpenseNotFoundException::new)
                .toExpenseDetail();
    }

    private BalancesInfo calculateBalances(Trip t){
        Map<UUID, BigDecimal> balances = new HashMap<>();
        List <SettlementSuggestion> settlements=new ArrayList<>();

        for (Expense e : t.getExpenses()) {
            BigDecimal total = e.getAmount();
            int n = e.getBeneficiaries().size();
            BigDecimal distributed = BigDecimal.ZERO;
            List<User> beneficiaries = new ArrayList<>(e.getBeneficiaries());

            for (int i = 0; i < n; i++) {
                User beneficiary = beneficiaries.get(i);
                BigDecimal share = i == n - 1
                        ? total.subtract(distributed)
                        : total.divide(BigDecimal.valueOf(n), 10, RoundingMode.HALF_UP);

                distributed = distributed.add(share);

                if (!beneficiary.getId().equals(e.getPayer().getId())) {
                    balances.merge(beneficiary.getId(), share.negate(), BigDecimal::add);
                    balances.merge(e.getPayer().getId(), share, BigDecimal::add);
                }
            }
        }
        for (Settlement s : t.getSettlements()) {
            balances.merge(s.getPayer().getId(), s.getAmount(), BigDecimal::add);
            balances.merge(s.getReceiver().getId(), s.getAmount().negate(), BigDecimal::add);
        }

        Map<UUID, BigDecimal> originalBalances = new HashMap<>(balances);

        boolean done=false;
        while(!done){
            UUID maxId = null, minId = null;
            BigDecimal max = null, min = null;

            for (Map.Entry<UUID, BigDecimal> entry : balances.entrySet()) {
                BigDecimal b = entry.getValue();
                if (max == null || b.compareTo(max) > 0) { max = b; maxId = entry.getKey(); }
                if (min == null || b.compareTo(min) < 0) { min = b; minId = entry.getKey(); }
            }
            if (max == null) { done = true; continue; }
            if(max.compareTo(BigDecimal.ZERO)>0 && min.compareTo(BigDecimal.ZERO)<0){
                if(max.abs().compareTo(min.abs())>0){
                    BigDecimal amount=min.abs();
                    max=max.subtract(amount);
                    balances.put(maxId,max);
                    balances.put(minId,BigDecimal.ZERO);
                    settlements.add(new SettlementSuggestion().
                            amount(amount.setScale(2, RoundingMode.HALF_UP).doubleValue())
                            .fromId(minId)
                            .toId(maxId));
                }else{
                    BigDecimal amount=max.abs();
                    min=min.add(amount);
                    balances.put(minId,min);
                    balances.put(maxId,BigDecimal.ZERO);
                    settlements.add(new SettlementSuggestion().
                            amount(amount.setScale(2, RoundingMode.HALF_UP).doubleValue())
                            .fromId(minId)
                            .toId(maxId));
                }
            }else{ done=true;}
        }

        List<UserBalance> userBalances = originalBalances.entrySet().stream()
                .map(e -> new UserBalance()
                        .userId(e.getKey())
                        .amount(e.getValue().setScale(2, RoundingMode.HALF_UP).doubleValue()))
                .toList();

        return new BalancesInfo()
                .settlements(settlements)
                .balances(userBalances);
    }
}
