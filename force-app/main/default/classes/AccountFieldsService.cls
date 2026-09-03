/**
 * AccountFieldsService
 * 
 * Service class for handling operations on the new Account custom fields
 * (Account_Summary__c and Account_Budget__c) added in KAN-1 user story
 */
public with sharing class AccountFieldsService {
    
    /**
     * Updates the account summary and budget fields
     * 
     * @param accountId The ID of the account to update
     * @param summary The account summary text
     * @param budget The account budget amount
     * @return The updated Account record
     */
    public static Account updateAccountFields(
        Id accountId,
        String summary,
        Decimal budget
    ) {
        Account account = new Account(
            Id = accountId,
            Account_Summary__c = summary,
            Account_Budget__c = budget
        );
        
        update account;
        return account;
    }
    
    /**
     * Retrieves accounts with their summary and budget information
     * 
     * @param limit The maximum number of records to return
     * @return List of Account records with custom fields
     */
    public static List<Account> getAccountsWithCustomFields(Integer recordLimit) {
        return [
            SELECT 
                Id,
                Name,
                Account_Summary__c,
                Account_Budget__c,
                Industry,
                Type
            FROM Account
            LIMIT :recordLimit
        ];
    }
    
    /**
     * Finds accounts with budget greater than specified amount
     * 
     * @param minimumBudget The minimum budget threshold
     * @return List of Account records with budget >= minimumBudget
     */
    public static List<Account> getAccountsByMinimumBudget(Decimal minimumBudget) {
        return [
            SELECT 
                Id,
                Name,
                Account_Budget__c,
                Account_Summary__c
            FROM Account
            WHERE Account_Budget__c >= :minimumBudget
            ORDER BY Account_Budget__c DESC
        ];
    }
    
    /**
     * Calculates total budget across all accounts
     * 
     * @return The sum of all Account_Budget__c values
     */
    public static Decimal getTotalAccountBudget() {
        AggregateResult result = [
            SELECT SUM(Account_Budget__c) totalBudget
            FROM Account
        ];
        
        Decimal totalBudget = (Decimal) result.get('totalBudget');
        return totalBudget != null ? totalBudget : 0;
    }
    
    /**
     * Validates account budget is within acceptable range
     * 
     * @param budget The budget amount to validate
     * @return true if budget is valid (>= 0), false otherwise
     */
    public static Boolean isValidBudget(Decimal budget) {
        return budget != null && budget >= 0;
    }
    
    /**
     * Gets accounts that have empty summary
     * 
     * @return List of Account records with null or empty Account_Summary__c
     */
    public static List<Account> getAccountsWithoutSummary() {
        List<Account> accountsWithoutSummary = new List<Account>();

        for (Account account : [
            SELECT 
                Id,
                Name,
                Account_Summary__c
            FROM Account
            ORDER BY Name
        ]) {
            if (String.isBlank(account.Account_Summary__c)) {
                accountsWithoutSummary.add(account);
            }
        }

        return accountsWithoutSummary;
    }
}