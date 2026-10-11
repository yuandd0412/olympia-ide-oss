; Olympia IDE — 在线引导安装器（web bootstrapper）
;
; 为什么需要它：真安装器 282 MiB，而 Cloudflare Pages 单文件 25 MiB、Gitee Release 附件
; 100 MB，且光 Electron 运行时压缩后就有 84.7 MiB —— "一个文件装完"在产品体积上做不到。
; 本文件编出来的引导器不含任何负载（约 2 MB）：运行时先取同版本发行版里的 SHA256SUMS.txt，
; 再按清单逐个下载真安装器及其 .bin 切片，逐个校验 SHA256，最后启动真安装器。
; 用户侧只有一次下载、一次安装。
;
; 编译（在 oss/ 下）：
;   node_modules\innosetup\bin\ISCC.exe /dReleaseTag=v1.140.0 build\win32\code-web.iss
; 产物 build\win32\web-out\OlympiaSetup-web.exe —— 官网按钮应该指向这个文件。
;
; 离线（机房断网）：把引导器和真安装器那一组文件（OlympiaSetup.exe + 各 .bin）放进同一个
; 目录再带过去，引导器发现同目录已有 OlympiaSetup.exe 就跳过下载直接启动它。

#ifndef ReleaseTag
  #error 需要传 /dReleaseTag=<Gitee 发行版标签>，否则引导器不知道去哪取文件
#endif

#define ManifestName "SHA256SUMS.txt"
#define RealSetupName "OlympiaSetup.exe"

[Setup]
AppName=Olympia IDE
AppVersion={#ReleaseTag}
AppPublisher=Olympia
AppPublisherURL=https://olympia.dpdns.org/
DefaultDirName={autopf}\OlympiaBootstrap
; 引导器不是产品本身：不注册卸载项，也不留开始菜单
Uninstallable=no
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=yes
DisableReadyPage=yes
DisableFinishedPage=yes
ShowLanguageDialog=no
Compression=lzma
SolidCompression=yes
MinVersion=10.0
PrivilegesRequired=lowest
ArchitecturesAllowed=x64Compatible
ArchitecturesInstallIn64BitMode=x64Compatible
OutputDir={#SourcePath}web-out
OutputBaseFilename=OlympiaSetup-web
SetupIconFile={#SourcePath}..\..\resources\win32\code.ico

[Languages]
Name: "simplifiedChinese"; MessagesFile: "{#SourcePath}i18n\Default.zh-cn.isl,{#SourcePath}i18n\messages.zh-cn.isl"

[Code]
const
  // 主站国内直连快；GitHub 只在 Gitee 那一发失败时兜底，逐文件切换而不是整包切换。
  GITEE_BASE = 'https://gitee.com/yuanddMSK/olympia-ide/releases/download/';
  GITHUB_BASE = 'https://github.com/yuandd0412/olympia-ide/releases/download/';
  USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
  MAX_ATTEMPTS = 3;

var
  WorkDir: string;
  FileNames: array of string;
  FileHashes: array of string;

procedure Say(const Msg: string);
begin
  Log('[olympia-bootstrap] ' + Msg);
end;

procedure ShowStatus(const Msg: string);
begin
  Say(Msg);
  if not WizardSilent() then
    WizardForm.StatusLabel.Caption := Msg;
end;

procedure ShowProgress(const Done, Total: Integer);
begin
  if WizardSilent() then Exit;
  WizardForm.ProgressGauge.Min := 0;
  WizardForm.ProgressGauge.Max := Total;
  WizardForm.ProgressGauge.Position := Done;
end;

procedure AbortWith(const Msg: string);
begin
  Say('FAILED: ' + Msg);
  if not WizardSilent() then
    MsgBox(Msg, mbError, MB_OK);
  { 必须真的中止：否则 Inno 会继续走完空 [Files] 并报"安装成功"，用户以为装好了。 }
  Abort;
end;

function OneFetch(const Url, DestPath: string): Boolean;
var
  Res: Integer;
begin
  { --fail turns an HTTP error into a non-zero exit instead of writing an HTML error page
    over the file we are about to hash. }
  Result := Exec('curl.exe', '-sSL --fail --retry 2 --retry-delay 2 --max-time 1800 -A "' +
    USER_AGENT + '" -o "' + DestPath + '" "' + Url + '"',
    WorkDir, SW_HIDE, ewWaitUntilTerminated, Res) and (Res = 0) and FileExists(DestPath);
end;

{ Downloads Url into DestPath, preferring Gitee and falling back to GitHub per attempt. }
function FetchInto(const Name, DestPath: string): Boolean;
var
  Attempt, I: Integer;
  Bases: array[0..1] of string;
begin
  Bases[0] := GITEE_BASE;
  Bases[1] := GITHUB_BASE;
  Result := False;
  for Attempt := 1 to MAX_ATTEMPTS do
  begin
    for I := 0 to 1 do
    begin
      DeleteFile(DestPath);
      if OneFetch(Bases[I] + '{#ReleaseTag}/' + Name, DestPath) then
      begin
        Result := True;
        Exit;
      end;
      Say('fetch failed from ' + Bases[I] + ' (attempt ' + IntToStr(Attempt) + '): ' + Name);
    end;
  end;
end;

function Sha256OfFile(const Path: string; out Hash: string): Boolean;
var
  Res: Integer;
  OutPath, Cmd: string;
  Raw: AnsiString;
  Text: string;
  Ret: Integer;
begin
  Hash := '';
  Result := False;
  OutPath := WorkDir + 'hash.out';
  DeleteFile(OutPath);
  { Written to a file rather than captured: certutil's output carries locale-dependent
    header text, so Get-FileHash writing bare hex to a file is the stable parse. }
  Cmd := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ' +
    '"$h=(Get-FileHash -LiteralPath ''' + Path + ''' -Algorithm SHA256).Hash; ' +
    '[IO.File]::WriteAllText(''' + OutPath + ''', $h)"';
  if not Exec('powershell.exe', Cmd, WorkDir, SW_HIDE, ewWaitUntilTerminated, Res) then Exit;
  if (Res <> 0) or not FileExists(OutPath) then Exit;
  if not LoadStringFromFile(OutPath, Raw) then Exit;
  Text := Trim(Raw);
  Ret := Pos(#13, Text);
  while Ret > 0 do
  begin
    Delete(Text, Ret, 1);
    Ret := Pos(#13, Text);
  end;
  Hash := Uppercase(Text);
  Result := Length(Hash) = 64;
end;

{ SHA256SUMS.txt is the coreutils format: "<64 hex><space><space>[*]<name>" }
function ParseManifest(const ManifestPath: string): Boolean;
var
  Raw: AnsiString;
  Text, Line, Name, Hash: string;
  Ret, I: Integer;
begin
  Result := False;
  if not LoadStringFromFile(ManifestPath, Raw) then Exit;
  Text := string(Raw);
  SetArrayLength(FileNames, 0);
  SetArrayLength(FileHashes, 0);
  while Text <> '' do
  begin
    Ret := Pos(#10, Text);
    if Ret > 0 then
    begin
      Line := Trim(Copy(Text, 1, Ret - 1));
      Delete(Text, 1, Ret);
    end
    else
    begin
      Line := Trim(Text);
      Text := '';
    end;
    { 64 hex + two separators + at least one character of name }
    if (Length(Line) > 66) and (Copy(Line, 65, 1) = ' ') then
    begin
      Hash := Uppercase(Copy(Line, 1, 64));
      Name := Trim(Copy(Line, 66, Length(Line) - 65));
      if Name = '' then Continue;
      if Name[1] = '*' then Delete(Name, 1, 1);
      I := GetArrayLength(FileNames);
      SetArrayLength(FileNames, I + 1);
      SetArrayLength(FileHashes, I + 1);
      FileNames[I] := Name;
      FileHashes[I] := Hash;
    end;
  end;
  Result := GetArrayLength(FileNames) > 0;
end;

{ Brings one manifest entry down and proves it is the right bytes. A file left over from an
  interrupted run is reused only if it already hashes correctly, so a half-written 94 MB
  slice can never be mistaken for a complete one. }
function FetchVerified(const Name, WantHash, DestPath: string): Boolean;
var
  GotHash: string;
begin
  Result := False;
  if FileExists(DestPath) and Sha256OfFile(DestPath, GotHash) and (GotHash = WantHash) then
  begin
    Say('reusing the already-downloaded ' + Name);
    Result := True;
    Exit;
  end;
  if not FetchInto(Name, DestPath) then Exit;
  if not Sha256OfFile(DestPath, GotHash) then
  begin
    DeleteFile(DestPath);
    Exit;
  end;
  if GotHash <> WantHash then
  begin
    Say('hash mismatch for ' + Name + ': want ' + WantHash + ' got ' + GotHash);
    DeleteFile(DestPath);
    Exit;
  end;
  Result := True;
end;

procedure LaunchRealSetup(const FromDir: string);
var
  Res: Integer;
begin
  { The real installer is disk-spanned, so its .bin slices must sit beside it — WorkDir
    holds every file the manifest named, which is exactly that set. }
  if not Exec(FromDir + '{#RealSetupName}', '/SILENT /NORESTART /SUPPRESSMSGBOXES', FromDir,
    SW_SHOWNORMAL, ewWaitUntilTerminated, Res) then
    AbortWith('无法启动安装程序（退出码 ' + IntToStr(Res) + '）。可以手动运行 ' +
      FromDir + '{#RealSetupName}。')
  else
    Say('the real installer finished with exit code ' + IntToStr(Res));
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ManifestPath, DestPath, LocalSetup, Name: string;
  I, Total, Done: Integer;
begin
  if CurStep <> ssInstall then Exit;

  WorkDir := AddBackslash(ExpandConstant('{tmp}\payload'));
  ForceDirectories(WorkDir);

  { Offline path first: a folder carrying the whole set beats any download. }
  LocalSetup := AddBackslash(ExpandConstant('{src}')) + '{#RealSetupName}';
  if FileExists(LocalSetup) then
  begin
    ShowStatus('检测到同目录已有安装程序，跳过下载');
    LaunchRealSetup(AddBackslash(ExpandConstant('{src}')));
    Exit;
  end;

  if not FileExists(ExpandConstant('{sys}\curl.exe')) then
  begin
    { 注意：续行不要以 # 开头，ISPP 会把行首的 # 当成预处理指令。 }
    AbortWith('这台机器上没有 curl.exe（Windows 10 1803 及以后自带），无法联网下载安装包。' + #13#10 + #13#10 +
      '请把引导器和安装器的分卷文件放在同一个目录里再运行。');
    Exit;
  end;

  ShowStatus('正在获取文件清单…');
  ManifestPath := WorkDir + '{#ManifestName}';
  if not FetchInto('{#ManifestName}', ManifestPath) then
  begin
    AbortWith('无法取得文件清单，请检查这台机器的网络。');
    Exit;
  end;
  if not ParseManifest(ManifestPath) then
  begin
    AbortWith('文件清单里没有任何条目，这个版本大概没传完。');
    Exit;
  end;

  Total := GetArrayLength(FileNames);
  Done := 0;
  for I := 0 to Total - 1 do
  begin
    Name := FileNames[I];
    if Name = '{#ManifestName}' then Continue;
    DestPath := WorkDir + Name;
    ShowProgress(Done, Total);
    ShowStatus('正在下载安装包（' + IntToStr(Done + 1) + '/' + IntToStr(Total) + '）：' + Name);
    if not FetchVerified(Name, FileHashes[I], DestPath) then
    begin
      AbortWith('下载或校验失败：' + Name + #13#10 +
        '可能是网络中断，也可能这个版本的文件被替换过。重新运行安装程序即可续传已完成的部分。');
      Exit;
    end;
    Done := Done + 1;
  end;

  if not FileExists(WorkDir + '{#RealSetupName}') then
  begin
    AbortWith('清单里没有 {#RealSetupName}，这个发行版不完整。');
    Exit;
  end;

  ShowProgress(Total, Total);
  ShowStatus('下载完成，正在安装…');
  LaunchRealSetup(WorkDir);
end;
