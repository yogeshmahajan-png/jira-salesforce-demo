/**
 * AccountFieldsServiceTest
 * 
 * Test class for AccountFieldsService
 * Tests the functionality of new Account custom fields added in KAN-1
 */
@isTest
public class AccountFieldsServiceTest {
    
    /**
     * Test setup - Creates test data
     */
    @testSetup
    static void setupTestData() {
        List<Account> testAccounts = new List<Account>();
        
        // Create test accounts with various budget amounts
        for (Integer i = 0; i < 5; i++) {
            testAccounts.add(new Account(
                Name = 'Test Account ' + i,
                Account_Summary__c = 'Test summary for account ' + i,
                Account_Budget__c = (i + 1) * 10000
            ));
        }
        
        // Create one account without summary
        testAccounts.add(new Account(
            Name = 'Account Without Summary',
            Account_Budget__c = 50000
        ));
        
        insert testAccounts;
    }
    
    /**
     * Test updateAccountFields method
     */
    @isTest
    static void testUpdateAccountFields() {
        Account testAccount = [
            SELECT Id, Account_Summary__c, Account_Budget__c 
            FROM Account 
            WHERE Name = 'Test Account 0' 
            LIMIT 1
        ];
        
        String newSummary = 'Updated summary';
        Decimal newBudget = 75000;
        
        AccountFieldsService.updateAccountFields(
            testAccount.Id,
            newSummary,
            newBudget
        );
        
        Account updatedAccount = [
            SELECT Account_Summary__c, Account_Budget__c 
            FROM Account 
            WHERE Id = :testAccount.Id
        ];
        
        System.assertEquals(newSummary, updatedAccount.Account_Summary__c);
        System.assertEquals(newBudget, updatedAccount.Account_Budget__c);
    }
    
    /**
     * Test getAccountsWithCustomFields method
     */
    @isTest
    static void testGetAccountsWithCustomFields() {
        List<Account> accounts = AccountFieldsService.getAccountsWithCustomFields(10);
        
        System.assert(accounts.size() > 0, 'Should return accounts');
        System.assert(accounts.size() <= 10, 'Should respect limit');
        
        for (Account acc : accounts) {
            System.assertNotEquals(null, acc.Id);
            System.assertNotEquals(null, acc.Name);
        }
    }
    
    /**
     * Test getAccountsByMinimumBudget method
     */
    @isTest
    static void testGetAccountsByMinimumBudget() {
        Decimal minimumBudget = 30000;
        
        List<Account> accounts = AccountFieldsService.getAccountsByMinimumBudget(minimumBudget);
        
        System.assert(accounts.size() > 0, 'Should return accounts');
        
        for (Account acc : accounts) {
            System.assert(
                acc.Account_Budget__c >= minimumBudget,
                'All accounts should meet minimum budget'
            );
        }
        
        // Verify descending order
        for (Integer i = 0; i < accounts.size() - 1; i++) {
            System.assert(
                accounts[i].Account_Budget__c >= accounts[i + 1].Account_Budget__c,
                'Accounts should be ordered by budget descending'
            );
        }
    }
    
    /**
     * Test getTotalAccountBudget method
     */
    @isTest
    static void testGetTotalAccountBudget() {
        Decimal totalBudget = AccountFieldsService.getTotalAccountBudget();
        
        System.assertNotEquals(null, totalBudget);
        System.assert(totalBudget > 0, 'Total budget should be positive');
    }
    
    /**
     * Test isValidBudget method
     */
    @isTest
    static void testIsValidBudget() {
        // Test valid budgets
        System.assert(AccountFieldsService.isValidBudget(0));
        System.assert(AccountFieldsService.isValidBudget(10000));
        System.assert(AccountFieldsService.isValidBudget(1000000));
        
        // Test invalid budgets
        System.assert(!AccountFieldsService.isValidBudget(-100));
        System.assert(!AccountFieldsService.isValidBudget(null));
    }
    
    /**
     * Test getAccountsWithoutSummary method
     */
    @isTest
    static void testGetAccountsWithoutSummary() {
        List<Account> accountsWithoutSummary = 
            AccountFieldsService.getAccountsWithoutSummary();
        
        System.assert(accountsWithoutSummary.size() > 0, 
            'Should return accounts without summary');
        
        // Verify one account matches our test data
        Boolean foundExpectedAccount = false;
        for (Account acc : accountsWithoutSummary) {
            if (acc.Name == 'Account Without Summary') {
                foundExpectedAccount = true;
                System.assertEquals(null, acc.Account_Summary__c);
            }
        }
        
        System.assert(foundExpectedAccount, 
            'Should find the account without summary');
    }
    
    /**
     * Test bulk update of account fields
     */
    @isTest
    static void testBulkUpdateAccountFields() {
        List<Account> accounts = [
            SELECT Id, Account_Summary__c, Account_Budget__c 
            FROM Account 
            LIMIT 5
        ];
        
        for (Account acc : accounts) {
            acc.Account_Summary__c = 'Bulk updated summary';
            acc.Account_Budget__c = 100000;
        }
        
        update accounts;
        
        List<Account> verifyAccounts = [
            SELECT Account_Summary__c, Account_Budget__c 
            FROM Account 
            WHERE Id IN :accounts
        ];
        
        for (Account acc : verifyAccounts) {
            System.assertEquals('Bulk updated summary', acc.Account_Summary__c);
            System.assertEquals(100000, acc.Account_Budget__c);
        }
    }
}