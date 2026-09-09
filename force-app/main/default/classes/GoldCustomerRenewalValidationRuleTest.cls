@isTest
private class GoldCustomerRenewalValidationRuleTest {
  @isTest
  static void silverCustomerWithoutRenewalDateIsRejected() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'Silver customer without renewal date',
        Customer_Tier1__c = 'Silver'
      ),
      false
    );

    System.assertEquals(
      false,
      result.isSuccess(),
      'Silver accounts must have a renewal date.'
    );
    System.assertEquals(1, result.getErrors().size());
    System.assertEquals(
      'Renewal Date is required when Customer Tier is Silver.',
      result.getErrors()[0].getMessage()
    );
    System.assertEquals(
      'RenewalNew_Date__c',
      result.getErrors()[0].getFields()[0]
    );
  }

  @isTest
  static void silverCustomerWithRenewalDateIsAccepted() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'Silver customer with renewal date',
        Customer_Tier1__c = 'Silver',
        RenewalNew_Date__c = Date.today().addDays(30)
      ),
      false
    );

    System.assertEquals(true, result.isSuccess());
  }

  @isTest
  static void bronzeCustomerWithoutRenewalDateIsAccepted() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'Bronze customer without renewal date',
        Customer_Tier1__c = 'Bronze'
      ),
      false
    );

    System.assertEquals(true, result.isSuccess());
  }

  @isTest
  static void removedGoldValueIsRejected() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'Account with removed Gold tier',
        Customer_Tier1__c = 'Gold',
        RenewalNew_Date__c = Date.today().addDays(30)
      ),
      false
    );

    System.assertEquals(
      false,
      result.isSuccess(),
      'Gold must no longer be accepted for Customer Tier1.'
    );
    System.assertEquals(
      StatusCode.INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST,
      result.getErrors()[0].getStatusCode()
    );
  }
}
