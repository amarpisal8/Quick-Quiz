Manual test checklist for Save Test / Load Saved Test

1. Pre-reqs
- Open the app (`index.html`) in a browser that supports IndexedDB (most modern browsers do).
- Open DevTools Console for quick commands.

2. Save a test
- Click the **Save Test** button.
- Expect: Alert "Test saved successfully" and the button becomes **Saved**.
- Expect: `#last-attempt` shows "No attempts yet".

3. List saved tests (optional - console)
- Run in console: `TestStorage.getAllTests().then(t => console.log(t));`
- Copy the `id` of a saved test (e.g., `test-abc123`).

4. Load saved test by id
- In console: `TestStorage.getSavedTest('<test-id>').then(console.log)`
- Expect: returns `{ test, questions, lastAttempt }` or `null` if not found.
- To load into the running app: `TestStorage.loadTestById('<test-id>').then(console.log)`
- Expect: App shows the saved test questions exactly as stored. The UI should not be broken.

5. Record an attempt
- Take the test and click **Final Submit**.
- Expect: Original PDF / final behavior remains unchanged.
- Expect: `#last-attempt` updates to a new timestamp and result summary.

6. Duplicate protection
- Click **Save Test** again on the same test.
- Expect: Alert "This test has already been saved." and no duplicate is created.

7. Manage saved tests UI
- Click **Saved Tests** to open the list modal.
- Expect: a list of saved tests with title, created date, question count and last attempt summary.
- Click **Load** on a test: Expect the app to load that test's questions, reset progress (it remains possible to change this behaviour), and the modal to close with an alert confirming load.
- Click **Details** to view attempt history for that test.

8. Edge cases
- If you pass an invalid id: `TestStorage.getSavedTest('no-such').then(console.log)` → Expect `null` and an alert.
- If IndexedDB is not available (rare), Save Test button will be disabled and an explanatory message is shown in `#last-attempt`.

Notes:
- All saved questions are deep-cloned before they are assigned to `quizData`. DB records are never modified by the app at runtime.
- To inspect raw DB contents, use browser devtools -> Application -> IndexedDB -> quick-quiz-db.
