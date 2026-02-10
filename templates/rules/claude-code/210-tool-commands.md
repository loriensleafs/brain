### Team Management

```bash
# View teammates (in-process mode)
Shift+Up/Down            # Select teammate to view/message
Enter                    # View selected teammate's session
Escape                   # Interrupt teammate's current turn
Ctrl+T                   # Toggle task list view

# Delegate mode (locks lead to coordination-only)
Shift+Tab                # Cycle into delegate mode

# Orphaned tmux sessions (split-pane mode)
tmux ls                  # List sessions
tmux kill-session -t <name>  # Clean up orphaned session
```
