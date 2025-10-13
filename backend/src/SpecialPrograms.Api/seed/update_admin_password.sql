USE [SpecialProgramsDb];
GO

-- Update admin password hash to the full bcrypt hash (no shell expansion when run via sqlcmd -i)
UPDATE dbo.Users
SET PasswordHash = '$2a$11$.BIBMDlimg6F6BA3178wle6DEWtOagTxL2BeF6hItBD.hB3FO0oUq'
WHERE Username = 'admin';
GO

SELECT Id, Username, PasswordHash FROM dbo.Users WHERE Username = 'admin';
GO
