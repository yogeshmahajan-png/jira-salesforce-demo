---
name: implement-qa
description: Run Salesforce QA for a Jira story and update Xray and Jira
argument-hint: Jira key, for example SF-125
agent: salesforce-qa
---

---

# Run Salesforce QA

Execute the Salesforce QA Agent for Jira story:

${input}

Follow the complete QA lifecycle:

1. Retrieve Jira story.
2. Validate Jira status.
3. Confirm status is Ready for QA.
4. Analyze the business requirement.
5. Create functional understanding.
6. Map acceptance criteria.
7. Generate positive tests.
8. Generate negative tests.
9. Generate boundary tests where applicable.
10. Generate security tests where applicable.
11. Generate integration tests where applicable.
12. Check test coverage.
13. Check for duplicate Xray tests.
14. Create missing Xray Test issues.
15. Create Xray Test Execution.
16. Execute available automated Salesforce tests.
17. Record actual results.
18. Update Xray execution results.
19. Calculate QA statistics.
20. Generate QA report.
21. Add QA report to Jira.
22. Transition Jira based on QA result.

Do not invent test results.

Do not modify Salesforce implementation.

Return a concise final report containing:

Jira Story
Jira Status
Xray Test Execution
Total Tests
Passed
Failed
Blocked
Not Executed
Pass Rate
Final QA Result
Jira Transition
Failed Tests
Recommended Action
