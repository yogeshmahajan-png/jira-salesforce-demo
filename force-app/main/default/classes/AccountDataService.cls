public with sharing class AccountDataService {
  public static final Integer DEFAULT_RECORD_LIMIT = 100;

  @AuraEnabled(cacheable=true)
  public static List<Account> getAccounts() {
    return queryAccounts(DEFAULT_RECORD_LIMIT);
  }

  public static List<Account> getAccountData() {
    return queryAccounts(DEFAULT_RECORD_LIMIT);
  }

  public static List<Account> fetchAccountData() {
    return queryAccounts(DEFAULT_RECORD_LIMIT);
  }

  public static List<Account> getAccounts(Integer recordLimit) {
    return queryAccounts(recordLimit);
  }

  public static List<Account> getAccountsByName(String searchTerm) {
    String normalizedSearchTerm = String.isBlank(searchTerm)
      ? '%'
      : searchTerm.trim() + '%';

    return [
      SELECT
        Id,
        Name,
        Phone,
        Website,
        Industry,
        Type,
        BillingCity,
        BillingState,
        AnnualRevenue
      FROM Account
      WHERE Name LIKE :normalizedSearchTerm
      ORDER BY Name ASC
      LIMIT 200
    ];
  }

  private static List<Account> queryAccounts(Integer recordLimit) {
    Integer safeLimit = recordLimit == null ||
      recordLimit <= 0
      ? DEFAULT_RECORD_LIMIT
      : recordLimit;
    safeLimit = Math.min(safeLimit, 5000);

    return [
      SELECT
        Id,
        Name,
        Phone,
        Website,
        Industry,
        Type,
        BillingCity,
        BillingState,
        AnnualRevenue
      FROM Account
      ORDER BY Name ASC
      LIMIT :safeLimit
    ];
  }
}
