; Inno-Setup-Skript fuer den Non-Planar Silicone Slicer.
; Baut aus dem PyInstaller-One-Folder einen Windows-Installer.
; Kompilieren:  ISCC build\installer.iss

#define AppName "Non-Planar Silicone Slicer"
#define AppVersion "0.1.0"
#define AppPublisher "go2dach"
#define AppExe "NonPlanarSiliconeSlicer.exe"

[Setup]
AppId={{8B5C2E10-4F3A-4E7C-9B2D-NPSLICER0001}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\NonPlanarSiliconeSlicer
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\dist_installer
OutputBaseFilename=NonPlanarSiliconeSlicer-{#AppVersion}-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
PrivilegesRequired=lowest

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\NonPlanarSiliconeSlicer\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
