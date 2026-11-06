# SPDX-License-Identifier: GPL-3.0-or-later
# Xvfb-only test input; production never imports this helper.
import ctypes,os,sys,time
x=ctypes.CDLL('libX11.so.6');t=ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.argtypes=[ctypes.c_char_p];x.XOpenDisplay.restype=ctypes.c_void_p
d=x.XOpenDisplay(os.environ['DISPLAY'].encode())
if not d:raise RuntimeError('No test X display')
x.XFlush.argtypes=[ctypes.c_void_p];x.XSync.argtypes=[ctypes.c_void_p,ctypes.c_int]
t.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]
t.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
def move(a,b):t.XTestFakeMotionEvent(d,-1,int(a),int(b),0);x.XFlush(d)
def button(down):t.XTestFakeButtonEvent(d,1,int(down),0);x.XFlush(d)
coords=list(map(int,sys.argv[1:]));ax,ay,bx,by=coords
move(ax,ay);time.sleep(.05);button(True);time.sleep(.03)
for i in range(1,21):move(ax+(bx-ax)*i/20,ay+(by-ay)*i/20);time.sleep(.02)
time.sleep(.12);button(False);x.XSync(d,False)
