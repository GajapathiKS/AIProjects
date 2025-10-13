using System.Linq;
using Microsoft.EntityFrameworkCore;
using SpecialPrograms.Api.Data;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Models;

namespace SpecialPrograms.Api.Services;

public class ProgressService(ApplicationDbContext context) : IProgressService
{
    public async Task<ProgressUpdateDto> CreateAsync(ProgressUpdateCreateDto dto)
    {
        var entity = new ProgressUpdate
        {
            GoalId = dto.GoalId,
            Summary = dto.Summary,
            Outcome = dto.Outcome,
            EvidenceUrl = dto.EvidenceUrl,
            NextAction = dto.NextAction,
            RecordedBy = dto.RecordedBy
        };

        context.ProgressUpdates.Add(entity);
        await context.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<IEnumerable<ProgressUpdateDto>> GetForGoalAsync(Guid goalId)
    {
        return await context.ProgressUpdates
            .AsNoTracking()
            .Where(p => p.GoalId == goalId)
            .OrderByDescending(p => p.RecordedAt)
            .Select(p => new ProgressUpdateDto(
                p.Id,
                p.GoalId,
                p.Summary,
                p.Outcome,
                p.EvidenceUrl,
                p.NextAction,
                p.RecordedBy,
                p.RecordedAt))
            .ToListAsync();
    }

    public async Task<ProgressUpdateDto?> UpdateAsync(Guid progressId, ProgressUpdateCreateDto dto)
    {
        var entity = await context.ProgressUpdates.FirstOrDefaultAsync(p => p.Id == progressId);
        if (entity is null)
        {
            return null;
        }

        entity.Summary = dto.Summary;
        entity.Outcome = dto.Outcome;
        entity.EvidenceUrl = dto.EvidenceUrl;
        entity.NextAction = dto.NextAction;
        entity.RecordedBy = dto.RecordedBy;
        await context.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid progressId)
    {
        var entity = await context.ProgressUpdates.FirstOrDefaultAsync(p => p.Id == progressId);
        if (entity is null)
        {
            return false;
        }

        context.ProgressUpdates.Remove(entity);
        await context.SaveChangesAsync();
        return true;
    }

    private static ProgressUpdateDto ToDto(ProgressUpdate entity)
    {
        return new ProgressUpdateDto(
            entity.Id,
            entity.GoalId,
            entity.Summary,
            entity.Outcome,
            entity.EvidenceUrl,
            entity.NextAction,
            entity.RecordedBy,
            entity.RecordedAt);
    }
}
