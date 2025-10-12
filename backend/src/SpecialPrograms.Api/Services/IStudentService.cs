using SpecialPrograms.Api.Dtos;

namespace SpecialPrograms.Api.Services;

public interface IStudentService
{
    Task<StudentSummaryDto> CreateAsync(StudentCreateDto dto);
    Task<StudentSummaryDto?> UpdateAsync(Guid id, StudentUpdateDto dto);
    Task<StudentDetailDto?> GetAsync(Guid id);
    Task<IEnumerable<StudentSummaryDto>> GetAllAsync();
    Task<bool> DeleteAsync(Guid id);
}
