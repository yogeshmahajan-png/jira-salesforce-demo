@isTest
private class HostingDateValidationRuleTest {
  @isTest
  static void ukAccountWithoutHostingDateIsRejected() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'UK account without hosting date',
        Hosting_Country__c = 'UK'
      ),
      false
    );

    System.assertEquals(false, result.isSuccess());
    System.assertEquals(1, result.getErrors().size());
    System.assertEquals(
      'Hosting Date is required when Hosting Country is USA or UK.',
      result.getErrors()[0].getMessage()
    );
    System.assertEquals(
      'Hosting_Date__c',
      result.getErrors()[0].getFields()[0]
    );
  }

  @isTest
  static void ukAccountWithHostingDateIsAccepted() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'UK account with hosting date',
        Hosting_Country__c = 'UK',
        Hosting_Date__c = Date.today().addDays(5)
      ),
      false
    );

    System.assertEquals(true, result.isSuccess());
  }

  @isTest
  static void usAccountWithoutHostingDateIsRejected() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'USA account without hosting date',
        Hosting_Country__c = 'USA'
      ),
      false
    );

    System.assertEquals(false, result.isSuccess());
    System.assertEquals(1, result.getErrors().size());
    System.assertEquals(
      'Hosting Date is required when Hosting Country is USA or UK.',
      result.getErrors()[0].getMessage()
    );
    System.assertEquals(
      'Hosting_Date__c',
      result.getErrors()[0].getFields()[0]
    );
  }

  @isTest
  static void usAccountWithHostingDateIsAccepted() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'USA account with hosting date',
        Hosting_Country__c = 'USA',
        Hosting_Date__c = Date.today().addDays(10)
      ),
      false
    );

    System.assertEquals(true, result.isSuccess());
  }

  @isTest
  static void canadaAccountWithoutHostingDateIsAccepted() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'Canada account without hosting date',
        Hosting_Country__c = 'CANADA'
      ),
      false
    );

    System.assertEquals(true, result.isSuccess());
  }
}
