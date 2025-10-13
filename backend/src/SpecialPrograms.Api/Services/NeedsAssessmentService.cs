using System.Linq;
using Microsoft.EntityFrameworkCore;
using SpecialPrograms.Api.Data;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Models;

namespace SpecialPrograms.Api.Services;

public class NeedsAssessmentService(ApplicationDbContext context) : INeedsAssessmentService
{
    public async Task<IEnumerable<NeedsAssessmentDto>> GetForStudentAsync(Guid studentId)
    {
        return await context.NeedsAssessments
            .AsNoTracking()
            .Where(n => n.StudentId == studentId)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NeedsAssessmentDto(
                n.Id,
                n.StudentId,
                n.AcademicNeeds,
                n.SupportServices,
                n.InstructionalStrategies,
                n.AssessmentTools,
                n.CreatedAt))
            .ToListAsync();
    }

    public async Task<NeedsAssessmentDto?> GetAsync(Guid id)
    {
        var entity = await context.NeedsAssessments.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<NeedsAssessmentDto> CreateAsync(NeedsAssessmentCreateDto dto)
    {
        var entity = new NeedsAssessment
        {
            StudentId = dto.StudentId,
            AcademicNeeds = dto.AcademicNeeds,
            SupportServices = dto.SupportServices,
            InstructionalStrategies = dto.InstructionalStrategies,
            AssessmentTools = dto.AssessmentTools
        };

        context.NeedsAssessments.Add(entity);
        await context.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<NeedsAssessmentDto?> UpdateAsync(Guid id, NeedsAssessmentUpdateDto dto)
    {
        var entity = await context.NeedsAssessments.FirstOrDefaultAsync(n => n.Id == id);
        if (entity is null)
        {
            return null;
        }

        entity.AcademicNeeds = dto.AcademicNeeds;
        entity.SupportServices = dto.SupportServices;
        entity.InstructionalStrategies = dto.InstructionalStrategies;
        entity.AssessmentTools = dto.AssessmentTools;

        await context.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await context.NeedsAssessments.FirstOrDefaultAsync(n => n.Id == id);
        if (entity is null)
        {
            return false;
        }

        context.NeedsAssessments.Remove(entity);
        await context.SaveChangesAsync();
        return true;
    }

    private static NeedsAssessmentDto ToDto(NeedsAssessment entity)
    {
        return new NeedsAssessmentDto(
            entity.Id,
            entity.StudentId,
            entity.AcademicNeeds,
            entity.SupportServices,
            entity.InstructionalStrategies,
            entity.AssessmentTools,
            entity.CreatedAt);
    }
}
