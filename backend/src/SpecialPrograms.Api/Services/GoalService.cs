using System.Linq;
using Microsoft.EntityFrameworkCore;
using SpecialPrograms.Api.Data;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Models;

namespace SpecialPrograms.Api.Services;

public class GoalService(ApplicationDbContext context) : IGoalService
{
    public async Task<GoalDto?> GetAsync(Guid goalId)
    {
        var entity = await context.Goals.AsNoTracking().FirstOrDefaultAsync(g => g.Id == goalId);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<GoalDto> CreateAsync(GoalCreateDto dto)
    {
        var entity = new Goal
        {
            StudentId = dto.StudentId,
            Description = dto.Description,
            Category = dto.Category,
            Measurement = dto.Measurement,
            Owner = dto.Owner,
            TargetDate = dto.TargetDate
        };

        context.Goals.Add(entity);
        await context.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<IEnumerable<GoalDto>> GetForStudentAsync(Guid studentId)
    {
        return await context.Goals
            .AsNoTracking()
            .Where(g => g.StudentId == studentId)
            .OrderByDescending(g => g.TargetDate)
            .Select(g => new GoalDto(
                g.Id,
                g.StudentId,
                g.Description,
                g.Category,
                g.Measurement,
                g.Owner,
                g.TargetDate,
                g.Status))
            .ToListAsync();
    }

    public async Task<GoalDto?> UpdateAsync(Guid goalId, GoalUpdateDto dto)
    {
        var entity = await context.Goals.FirstOrDefaultAsync(g => g.Id == goalId);
        if (entity is null)
        {
            return null;
        }

        entity.Description = dto.Description;
        entity.Category = dto.Category;
        entity.Measurement = dto.Measurement;
        entity.Owner = dto.Owner;
        entity.TargetDate = dto.TargetDate;
        entity.Status = dto.Status;
        await context.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<bool> UpdateStatusAsync(Guid goalId, string status)
    {
        var entity = await context.Goals.FirstOrDefaultAsync(g => g.Id == goalId);
        if (entity is null)
        {
            return false;
        }

        entity.Status = status;
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid goalId)
    {
        var entity = await context.Goals.FirstOrDefaultAsync(g => g.Id == goalId);
        if (entity is null)
        {
            return false;
        }

        context.Goals.Remove(entity);
        await context.SaveChangesAsync();
        return true;
    }

    private static GoalDto ToDto(Goal entity)
    {
        return new GoalDto(
            entity.Id,
            entity.StudentId,
            entity.Description,
            entity.Category,
            entity.Measurement,
            entity.Owner,
            entity.TargetDate,
            entity.Status);
    }
}
