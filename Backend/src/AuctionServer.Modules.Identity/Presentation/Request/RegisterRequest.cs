using System.ComponentModel.DataAnnotations;

namespace AuctionServer.Modules.Identity.Presentation.Request;

public record RegisterRequest : IValidatableObject
{
    [Required(ErrorMessage = "Email required")]
    [EmailAddress(ErrorMessage = "Incorrect email address")]
    public string Email = string.Empty;
    
    [MinLength(8, ErrorMessage = "Too short password")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$", 
        ErrorMessage = "Password is too weak.")]
    public string Password = string.Empty;
    
    [Required(ErrorMessage = "Username is required.")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "Username must be 2-50 chars length.")]
    public string Username = string.Empty;
    
    [Required(ErrorMessage = "Name is required.")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "Name must be 2-50 chars length.")]
    public string Name = string.Empty;
    
    [Required(ErrorMessage = "Surname is required.")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "Surname must be 2-50 chars length.")]
    public string Surname = string.Empty;
    
    [Required(ErrorMessage = "Birthday is required.")] 
    public DateOnly Birthday;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Birthday > DateOnly.FromDateTime(DateTime.Now))
        {
            yield return new ValidationResult("Birthday must be from past", [nameof(Birthday)]);
        }
    }

};