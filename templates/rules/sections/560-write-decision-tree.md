### Write Operation Decision Tree

```text
Need to write/edit a memory note?
|-> Run pre-flight validation checklist
|   |-> All PASS -> Proceed with write_note/edit_note
|   +-> Any FAIL -> Fix: wrong folder? missing CAPS? <3 observations? no relations?
|-> Unsure about conventions? -> Consult entity type mapping above
+-> Read/search operations -> Always allowed directly (no validation needed)
```

All {{workers}} write directly. No delegation to memory {{worker}} required for writes.
