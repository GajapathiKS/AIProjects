using SpecialPrograms.Api.Dtos;

namespace SpecialPrograms.Api.Services;

public interface INeedsAssessmentService
{
    Task<IEnumerable<NeedsAssessmentDto>> GetForStudentAsync(Guid studentId);
    Task<NeedsAssessmentDto?> GetAsync(Guid id);
    Task<NeedsAssessmentDto> CreateAsync(NeedsAssessmentCreateDto dto);
    Task<NeedsAssessmentDto?> UpdateAsync(Guid id, NeedsAssessmentUpdateDto dto);
    Task<bool> DeleteAsync(Guid id);
}
