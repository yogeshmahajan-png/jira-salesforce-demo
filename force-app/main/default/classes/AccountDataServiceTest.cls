@isTest
public class AccountDataServiceTest {
  @testSetup
  static void setupTestData() {
    List<Account> accounts = new List<Account>();
    for (Integer i = 0; i < 5; i++) {
      accounts.add(
        new Account(
          Name = 'Account ' + String.valueOf(i + 1),
          Phone = '555-000' + String.valueOf(i),
          Industry = 'Technology',
          Type = 'Customer',
          AnnualRevenue = 10000 + (i * 1000)
        )
      );
    }
    insert accounts;
  }

  @isTest
  static void testGetAccountsReturnsOrderedRecords() {
    Test.startTest();
    List<Account> result = AccountDataService.getAccounts(10);
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null.');
    System.assertEquals(5, result.size(), 'Expected five test records.');

    for (Integer i = 1; i < result.size(); i++) {
      System.assert(
        result[i - 1].Name <= result[i].Name,
        'Accounts should be returned in ascending order by Name.'
      );
    }
  }

  @isTest
  static void testFetchAndAliasMethodsReturnAccounts() {
    Test.startTest();
    List<Account> data = AccountDataService.getAccountData();
    List<Account> fetched = AccountDataService.fetchAccountData();
    List<Account> named = AccountDataService.getAccountsByName('Account');
    Test.stopTest();

    System.assertEquals(
      5,
      data.size(),
      'getAccountData should return all seeded records.'
    );
    System.assertEquals(
      5,
      fetched.size(),
      'fetchAccountData should return all seeded records.'
    );
    System.assertEquals(
      5,
      named.size(),
      'getAccountsByName should return seeded records matching the prefix.'
    );
  }

  @isTest
  static void testGetAccountsReturnsEmptyListWhenNoRecordsExist() {
    delete [SELECT Id FROM Account];

    Test.startTest();
    List<Account> result = AccountDataService.getAccounts(10);
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null.');
    System.assertEquals(
      0,
      result.size(),
      'No records should return an empty list.'
    );
  }
}
