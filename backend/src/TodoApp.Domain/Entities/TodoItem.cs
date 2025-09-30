namespace TodoApp.Domain.Entities;

public class TodoItem
{
    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public bool IsCompleted { get; private set; }

    private TodoItem()
    {
    }

    public TodoItem(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title cannot be empty", nameof(title));
        }

        Id = Guid.NewGuid();
        Title = title.Trim();
    }

    public void MarkCompleted() => SetCompletionStatus(true);

    public void SetCompletionStatus(bool isCompleted)
    {
        IsCompleted = isCompleted;
    }

    public void UpdateTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title cannot be empty", nameof(title));
        }

        Title = title.Trim();
    }
}
