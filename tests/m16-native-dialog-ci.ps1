# M16.4 private Windows CI: choose only a synthetic file from the actual native
# Windows Common Item Dialog. No user desktop or patient data is ever involved.
param([Parameter(Mandatory=$true)][int] $ElectronPid)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or
    [string]::IsNullOrWhiteSpace($env:M16_NATIVE_SAMPLE)) {
  throw 'Private hosted Windows fixture required'
}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class M16NativeWindow {
  public delegate bool Enumerator(IntPtr hwnd, IntPtr state);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Enumerator cb, IntPtr state);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hwnd, StringBuilder output, int size);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetClassName(IntPtr hwnd, StringBuilder output, int size);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint process);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int command);
  public static IntPtr Find(uint mainProcess) {
    IntPtr result = IntPtr.Zero;
    EnumWindows((hwnd, state) => {
      if(!IsWindowVisible(hwnd)) return true;
      uint process; GetWindowThreadProcessId(hwnd, out process);
      var caption = new StringBuilder(260); GetWindowText(hwnd, caption, caption.Capacity);
      var klass = new StringBuilder(120); GetClassName(hwnd, klass, klass.Capacity);
      string title = caption.ToString(), cls = klass.ToString();
      bool exact = title.IndexOf("Choose local files for Sajilo Dental", StringComparison.OrdinalIgnoreCase)>=0;
      bool native = cls=="#32770" && (title=="Open" || title=="Choose" || title.Contains("Choose local files"));
      if(exact || (process==mainProcess && native)) { result=hwnd; return false; }
      return true;
    }, IntPtr.Zero);
    return result;
  }
  public static string Diagnostic(uint mainProcess) {
    var list=new List<string>();
    EnumWindows((hwnd,state)=>{
      if(!IsWindowVisible(hwnd)) return true;
      uint process; GetWindowThreadProcessId(hwnd,out process);
      var t=new StringBuilder(260);GetWindowText(hwnd,t,t.Capacity);
      var c=new StringBuilder(120);GetClassName(hwnd,c,c.Capacity);
      if(process==mainProcess || t.ToString().Contains("Choose local files") ||
         (c.ToString()=="#32770" && list.Count<12))
        list.Add("class="+c+" caption="+t+" matchingProcess="+(process==mainProcess));
      return true;
    },IntPtr.Zero);
    return string.Join(" | ",list);
  }
}
'@
$deadline=(Get-Date).AddSeconds(13)
$dialog=[IntPtr]::Zero
do {
  $dialog=[M16NativeWindow]::Find([uint32]$ElectronPid)
  if($dialog -ne [IntPtr]::Zero) { break }
  Start-Sleep -Milliseconds 150
} while ((Get-Date) -lt $deadline)
if($dialog -eq [IntPtr]::Zero) {
  throw ('Native dialog not found. Visible dialog metadata only: '+
         [M16NativeWindow]::Diagnostic([uint32]$ElectronPid))
}
Write-Output 'Native Windows file dialog located'
[void][M16NativeWindow]::ShowWindow($dialog,9)
[void][M16NativeWindow]::SetForegroundWindow($dialog)
Start-Sleep -Milliseconds 200
$setByAutomation=$false
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $root=[System.Windows.Automation.AutomationElement]::FromHandle($dialog)
  $match=[System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, '1148')
  $edit=$root.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$match)
  if($null -ne $edit) {
    $value=$edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $value.SetValue($env:M16_NATIVE_SAMPLE)
    try { $edit.SetFocus() } catch { }
    $setByAutomation=$true
    Write-Output 'Native Windows file name field populated via UI Automation'
  }
} catch {
  Write-Output 'Native filename UI Automation unavailable; using native keyboard fallback'
}
if(-not $setByAutomation) {
  [System.Windows.Forms.SendKeys]::SendWait('%n')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.Clipboard]::SetText($env:M16_NATIVE_SAMPLE)
  [System.Windows.Forms.SendKeys]::SendWait('^v')
}
Start-Sleep -Milliseconds 120
$invoked=$false
if($setByAutomation) {
  try {
    $buttons=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button))
    foreach($button in $buttons) {
      if($button.Current.Name -match '^(Open|Choose)(\s|$)') {
        $pattern=$button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $pattern.Invoke()
        $invoked=$true
        Write-Output 'Native dialog submitted using UI Automation'
        break
      }
    }
  } catch { Write-Output 'Native invoke unavailable; using Enter fallback' }
}
if(-not $invoked) { [System.Windows.Forms.SendKeys]::SendWait('{ENTER}') }
Write-Output 'Native dialog selection submitted'
