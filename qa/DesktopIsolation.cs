using System;
using System.Text;
using System.ComponentModel;
using System.Runtime.InteropServices;

// Windows desktops isolate test windows even if Excel makes them visible.
// No SwitchDesktop, global Excel lookup, or user-process termination is used.
public static class DesktopIsolation {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct StartupInfo {
        public int cb; public string reserved, desktop, title;
        public uint x,y,xSize,ySize,xChars,yChars,fill,flags;
        public short show, reservedSize; public IntPtr reserved2, input, output, error;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct ProcessInfo { public IntPtr process, thread; public uint pid, tid; }
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimit {
        public long processTime, jobTime; public uint flags;
        public UIntPtr minWorking, maxWorking; public uint activeLimit;
        public UIntPtr affinity; public uint priority, scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters { public ulong a,b,c,d,e,f; }
    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimit { public BasicLimit basic; public IoCounters io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
    delegate bool EnumWindow(IntPtr window, IntPtr data);
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateDesktop(string name, IntPtr device, IntPtr mode, uint flags, uint access, IntPtr security);
    [DllImport("user32.dll", SetLastError=true)] public static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
    [DllImport("user32.dll")] static extern IntPtr GetThreadDesktop(uint id);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool GetUserObjectInformation(IntPtr handle, int index, StringBuilder value, uint size, out uint needed);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref StartupInfo startup, out ProcessInfo info);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int type, ref ExtendedLimit data, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint ms);
    [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr handle, out uint code);
    [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr handle, uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("user32.dll")] static extern bool EnumDesktopWindows(IntPtr desktop, EnumWindow callback, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindow callback, IntPtr data);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder name, int max);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr window, uint objectId, ref Guid iid, [MarshalAs(UnmanagedType.IDispatch)] out object value);

    static void Check(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    static string Name(IntPtr desktop) {
        var name=new StringBuilder(256); uint needed;
        Check(GetUserObjectInformation(desktop, 2, name, 512, out needed)); return name.ToString();
    }
    public static string CurrentDesktop() { return Name(GetThreadDesktop(GetCurrentThreadId())); }
    public static string InputDesktop() {
        var desktop=OpenInputDesktop(0,false,1);
        if (desktop==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try { return Name(desktop); } finally { CloseDesktop(desktop); }
    }
    public static IntPtr NewDesktop(string name) {
        var desktop=CreateDesktop(name,IntPtr.Zero,IntPtr.Zero,0,0x01FF,IntPtr.Zero);
        if (desktop==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        if (Name(desktop)==InputDesktop()) { CloseDesktop(desktop); throw new Exception("Refusing the input desktop."); }
        return desktop;
    }
    public sealed class Child : IDisposable {
        IntPtr process, job; public uint Id;
        internal Child(IntPtr p,IntPtr j,uint id) { process=p; job=j; Id=id; }
        public int Wait(uint ms) {
            if (WaitForSingleObject(process,ms)!=0) throw new TimeoutException("Isolated process exceeded its time limit.");
            uint code; GetExitCodeProcess(process,out code); return unchecked((int)code);
        }
        public void Dispose() {
            // The job contains only the worker and processes it created, never user Excel.
            if (job!=IntPtr.Zero) { CloseHandle(job); job=IntPtr.Zero; }
            if (process!=IntPtr.Zero) { CloseHandle(process); process=IntPtr.Zero; }
        }
    }
    public static Child Start(string executable,string arguments,string desktop,string cwd) {
        if (desktop==InputDesktop()) throw new Exception("Refusing to launch on the input desktop.");
        var job=CreateJobObject(IntPtr.Zero,null);
        if (job==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        ProcessInfo info=new ProcessInfo();
        try {
            var limit=new ExtendedLimit(); limit.basic.flags=0x2000; // Kill owned descendants on close.
            Check(SetInformationJobObject(job,9,ref limit,(uint)Marshal.SizeOf(limit)));
            var startup=new StartupInfo { cb=Marshal.SizeOf(typeof(StartupInfo)),desktop=desktop,flags=0x81,show=0 };
            Check(CreateProcess(executable,new StringBuilder("\""+executable+"\" "+arguments),IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,cwd,ref startup,out info));
            Check(AssignProcessToJobObject(job,info.process));
            if (ResumeThread(info.thread)==0xFFFFFFFF) throw new Win32Exception(Marshal.GetLastWin32Error());
            return new Child(info.process,job,info.pid);
        } catch {
            if (info.process!=IntPtr.Zero) { TerminateProcess(info.process,1); CloseHandle(info.process); }
            CloseHandle(job); throw;
        } finally { if (info.thread!=IntPtr.Zero) CloseHandle(info.thread); }
    }
    public static object ExcelWindow(uint processId) {
        object found=null;
        EnumDesktopWindows(GetThreadDesktop(GetCurrentThreadId()),delegate(IntPtr top,IntPtr ignored) {
            uint pid; GetWindowThreadProcessId(top,out pid); if (pid!=processId) return true;
            EnumChildWindows(top,delegate(IntPtr child,IntPtr unused) {
                var name=new StringBuilder(256); GetClassName(child,name,256);
                if (name.ToString()!="EXCEL7") return true;
                var iid=new Guid("00020400-0000-0000-C000-000000000046"); object value;
                if (AccessibleObjectFromWindow(child,0xFFFFFFF0,ref iid,out value)==0) found=value;
                return found==null;
            },IntPtr.Zero);
            return found==null;
        },IntPtr.Zero);
        return found;
    }
    public static string WindowDesktop(IntPtr window) { uint pid; return Name(GetThreadDesktop(GetWindowThreadProcessId(window,out pid))); }
    public static uint WindowProcess(IntPtr window) { uint pid; GetWindowThreadProcessId(window,out pid); return pid; }
}
