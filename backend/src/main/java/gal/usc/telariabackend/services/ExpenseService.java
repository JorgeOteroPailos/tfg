package gal.usc.telariabackend.services;

import gal.usc.telariabackend.model.Expense;
import gal.usc.telariabackend.model.Trip;
import gal.usc.telariabackend.model.User;
import gal.usc.telariabackend.model.dto.CreateExpenseRequest;
import gal.usc.telariabackend.model.dto.ExpenseSummary;
import gal.usc.telariabackend.model.dto.Settlement;
import gal.usc.telariabackend.model.exceptions.ExpenseNotFoundException;
import gal.usc.telariabackend.model.exceptions.NotATripMemberException;
import gal.usc.telariabackend.repository.ExpenseRepository;
import gal.usc.telariabackend.repository.TripRepository;
import gal.usc.telariabackend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
                .orElseThrow(NotATripMemberException::new);

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
                creator,
                beneficiaries);
        expenseRepo.save(e);
        return e.getId();
    }


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

    public List<Settlement> getBalances(UUID tripId, UUID userId){
        List<Expense> expenses=tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new).getExpenses();
        return null; //TODO
    }

    public List<ExpenseSummary> listExpenses(UUID tripId, UUID userId) {
        Trip t=tripRepo.findByIdAndMembersId(tripId, userId)
                .orElseThrow(NotATripMemberException::new);
        return t.getExpenses().stream().map(Expense::toExpenseSummary).toList();
    }

    private List<Settlement> balancesCalculatorHelper(Trip t){
        Map<UUID, BigDecimal> balances = new HashMap<>();
        List <Settlement> settlements=new ArrayList<>();

        for (Expense e : t.getExpenses()) {
            BigDecimal total = e.getAmount();
            int n = e.getBeneficiaries().size();
            BigDecimal distributed = BigDecimal.ZERO;
            List<User> beneficiaries = new ArrayList<>(e.getBeneficiaries()); //TODO ver si hacerle un shuffle

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

        boolean done=false;
        while(!done){
            BigDecimal max = BigDecimal.ZERO;
            BigDecimal min = BigDecimal.valueOf(Integer.MAX_VALUE);
            UUID maxDebtor=null;
            UUID minDebtor=null;
            for(Map.Entry<UUID, BigDecimal> entry : balances.entrySet()){
                BigDecimal b= entry.getValue();
                if(b.compareTo(min)<0){
                    min=b;
                    maxDebtor=entry.getKey();
                }else{
                    max=b;
                    minDebtor=entry.getKey();
                }
            }
            if(max.compareTo(BigDecimal.ZERO)>0 && min.compareTo(BigDecimal.ZERO)<0){
                if(max.abs().compareTo(min)>0){
                    max=max.subtract(min.abs());
                    //balances.
                }
            }else{ done=true;}
        }


        return null; //TODO
    }
}
