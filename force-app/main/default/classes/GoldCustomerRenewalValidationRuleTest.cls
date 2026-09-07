@isTest
private class GoldCustomerRenewalValidationRuleTest {
  @isTest
  static void goldCustomerWithoutRenewalDateIsRejected() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'Gold customer without renewal date',
        Customer_Tier1__c = 'Gold'
      ),
      false
    );

    System.assertEquals(
      false,
      result.isSuccess(),
      'Gold accounts must have a renewal date.'
    );
    System.assertEquals(1, result.getErrors().size());
    System.assertEquals(
      'Renewal Date is required when Customer Tier is Gold.',
      result.getErrors()[0].getMessage()
    );
    System.assertEquals(
      'RenewalNew_Date__c',
      result.getErrors()[0].getFields()[0]
    );
  }

  @isTest
  static void goldCustomerWithRenewalDateIsAccepted() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'Gold customer with renewal date',
        Customer_Tier1__c = 'Gold',
        RenewalNew_Date__c = Date.today().addDays(30)
      ),
      false
    );

    System.assertEquals(true, result.isSuccess());
  }

  @isTest
  static void nonGoldCustomerWithoutRenewalDateIsAccepted() {
    Database.SaveResult result = Database.insert(
      new Account(
        Name = 'Silver customer without renewal date',
        Customer_Tier1__c = 'Silver'
      ),
      false
    );

    System.assertEquals(true, result.isSuccess());
  }
}
