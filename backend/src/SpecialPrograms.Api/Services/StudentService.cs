using Microsoft.EntityFrameworkCore;
using SpecialPrograms.Api.Data;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Models;

namespace SpecialPrograms.Api.Services;

public class StudentService(ApplicationDbContext context) : IStudentService
{
    public async Task<StudentSummaryDto> CreateAsync(StudentCreateDto dto)
    {
        var entity = new Student
        {
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            DateOfBirth = dto.DateOfBirth,
            GradeLevel = dto.GradeLevel,
            Campus = dto.Campus,
            GuardianContact = dto.GuardianContact,
            ProgramFocus = dto.ProgramFocus,
            LocalId = dto.LocalId,
            EnrollmentDate = dto.EnrollmentDate,
            NextReviewDate = dto.NextReviewDate
        };

        context.Students.Add(entity);
        await context.SaveChangesAsync();

        return ToSummary(entity);
    }

    public async Task<StudentSummaryDto?> UpdateAsync(Guid id, StudentUpdateDto dto)
    {
        var entity = await context.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null)
        {
            return null;
        }

        entity.FirstName = dto.FirstName;
        entity.LastName = dto.LastName;
        entity.DateOfBirth = dto.DateOfBirth;
        entity.GradeLevel = dto.GradeLevel;
        entity.Campus = dto.Campus;
        entity.GuardianContact = dto.GuardianContact;
        entity.ProgramFocus = dto.ProgramFocus;
        entity.LocalId = dto.LocalId;
        entity.EnrollmentDate = dto.EnrollmentDate;
        entity.NextReviewDate = dto.NextReviewDate;

        await context.SaveChangesAsync();
        await context.Entry(entity).Collection(s => s.Goals).LoadAsync();
        await context.Entry(entity).Collection(s => s.NeedsAssessments).LoadAsync();

        return ToSummary(entity);
    }

    public async Task<StudentDetailDto?> GetAsync(Guid id)
    {
        var entity = await context.Students
            .AsNoTracking()
            .Include(s => s.NeedsAssessments)
            .Include(s => s.Goals)
                .ThenInclude(g => g.ProgressUpdates)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (entity is null)
        {
            return null;
        }

        return new StudentDetailDto(
            entity.Id,
            entity.LocalId,
            entity.FirstName,
            entity.LastName,
            entity.DateOfBirth,
            entity.GradeLevel,
            entity.Campus,
            entity.GuardianContact,
            entity.ProgramFocus,
            entity.EnrollmentDate,
            entity.NextReviewDate,
            entity.NeedsAssessments
                .OrderByDescending(n => n.CreatedAt)
                .Select(ToAssessmentDto)
                .ToList(),
            entity.Goals
                .OrderByDescending(g => g.TargetDate)
                .Select(g => new GoalDetailDto(
                    g.Id,
                    g.StudentId,
                    g.Description,
                    g.Category,
                    g.Measurement,
                    g.Owner,
                    g.TargetDate,
                    g.Status,
                    g.ProgressUpdates
                        .OrderByDescending(p => p.RecordedAt)
                        .Select(ToProgressDto)
                        .ToList()))
                .ToList());
    }

    public async Task<IEnumerable<StudentSummaryDto>> GetAllAsync()
    {
        return await context.Students
            .AsNoTracking()
            .OrderBy(s => s.LastName)
            .Select(s => new StudentSummaryDto(
                s.Id,
                s.LocalId,
                s.FirstName,
                s.LastName,
                s.GradeLevel,
                s.Campus,
                s.ProgramFocus,
                s.EnrollmentDate,
                s.NextReviewDate,
                s.NeedsAssessments.Count,
                s.Goals.Count,
                s.Goals.Count(g => g.Status != "Completed")))
            .ToListAsync();
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await context.Students.FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null)
        {
            return false;
        }

        context.Students.Remove(entity);
        await context.SaveChangesAsync();
        return true;
    }

    private static StudentSummaryDto ToSummary(Student entity)
    {
        return new StudentSummaryDto(
            entity.Id,
            entity.LocalId,
            entity.FirstName,
            entity.LastName,
            entity.GradeLevel,
            entity.Campus,
            entity.ProgramFocus,
            entity.EnrollmentDate,
            entity.NextReviewDate,
            entity.NeedsAssessments.Count,
            entity.Goals.Count,
            entity.Goals.Count(g => g.Status != "Completed"));
    }

    private static NeedsAssessmentDto ToAssessmentDto(NeedsAssessment assessment)
    {
        return new NeedsAssessmentDto(
            assessment.Id,
            assessment.StudentId,
            assessment.AcademicNeeds,
            assessment.SupportServices,
            assessment.InstructionalStrategies,
            assessment.AssessmentTools,
            assessment.CreatedAt);
    }

    private static ProgressUpdateDto ToProgressDto(ProgressUpdate progress)
    {
        return new ProgressUpdateDto(
            progress.Id,
            progress.GoalId,
            progress.Summary,
            progress.Outcome,
            progress.EvidenceUrl,
            progress.NextAction,
            progress.RecordedBy,
            progress.RecordedAt);
    }
}
