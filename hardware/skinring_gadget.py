"""SkinRing gadget - parametric model (units: mm). Run: python skinring_gadget.py [outdir]

Two printed parts, no springs or screws:
  frame.stl   skin ring (50 mm opening) + 3 struts + slider plate with dovetail edges.
              Print as exported: slider plate on the bed, ring on top. No supports.
  cradle.stl  phone plate with viewing slot and dovetail rails. The slider sits in the
              rails and moves sideways to centre the ring on any phone's main camera.
              The phone is held on the flat back with two rubber bands (notches on the
              sides). Print as exported: phone side on the bed. No supports.

The camera lens touches the cradle's flat side, so LENS_TO_SKIN is the fixed lens-to-skin
distance. Change the parameters below and re-run to get new STLs.
"""
import math
import os
import struct
import sys

from manifold3d import Manifold

# ---- parameters ----
RING_ID = 50.0        # ring opening = the measurement reference the app uses (mm)
RING_W = 8.0          # radial width of the ring band
RING_T = 4.0          # ring thickness (skin side to camera side)
LENS_TO_SKIN = 80.0   # camera lens to skin surface; at 80 mm a typical main camera (~50° across the short side) sees ~73 mm, so the 50 mm ring fills ~68 % of the image width, inside the app's ring search window (56-92 %)
STRUT_D = 8.0
STRUT_ANGLES = (0, 120, 240)  # degrees; 90 = 12 o'clock (notch). Keep struts clear of the rails (|y| < slider top half-width)
NOTCH_DEPTH = 3.0     # V-notch in the ring's inner edge at 12 o'clock (rotation reference)
GREY_PATCH = 7.0      # square recess on the camera side for a grey reference sticker
GREY_PATCH_DEPTH = 0.6
GREY_PATCH_ANGLE = 180

SLIDER_W, SLIDER_H, SLIDER_T = 74.0, 70.0, 5.0
DOVETAIL = 3.0        # how much the slider narrows per side from bottom to top
SIGHT_HOLE_D = 38.0   # opening for lens + flash in the slider

CRADLE_W, CRADLE_T = 120.0, 3.0
CRADLE_ABOVE = 55.0   # cradle extends this far above the ring axis
CRADLE_BELOW = 110.0  # ... and this far below (room for the phone body + bands)
SLOT_W, SLOT_H = 96.0, 40.0  # viewing slot in the cradle (sideways travel of the lens)
RAIL_W = 8.0
CLEARANCE = 0.3
BAND_NOTCH = (3.0, 5.0)        # notch size (x, y) in the side edges
BAND_NOTCH_Y = (-62.0, -97.0)  # notch positions below the ring axis

SEG = 128
STRUT_LEN = LENS_TO_SKIN - CRADLE_T - SLIDER_T - RING_T
assert STRUT_LEN > 20, "LENS_TO_SKIN too short for the chosen plate thicknesses"


def box(x0, y0, z0, x1, y1, z1):
    return Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])


def cyl(h, r, z0=0.0, x=0.0, y=0.0):
    return Manifold.cylinder(h, r, r, SEG).translate([x, y, z0])


def polar(r, deg):
    a = math.radians(deg)
    return r * math.cos(a), r * math.sin(a)


def dovetail_slab(w, h_bottom, h_top, t):
    """Plate w x h centred on the axis, narrowing from h_bottom (z=0) to h_top (z=t) in y."""
    eps = 0.01
    bottom = box(-w / 2, -h_bottom / 2, 0, w / 2, h_bottom / 2, eps)
    top = box(-w / 2, -h_top / 2, t - eps, w / 2, h_top / 2, t)
    return Manifold.batch_hull([bottom, top])


def frame():
    r_in, r_out = RING_ID / 2, RING_ID / 2 + RING_W
    r_mid = (r_in + r_out) / 2
    slider = dovetail_slab(SLIDER_W, SLIDER_H, SLIDER_H - 2 * DOVETAIL, SLIDER_T)
    slider -= cyl(SLIDER_T + 2, SIGHT_HOLE_D / 2, -1)

    ring_z = SLIDER_T + STRUT_LEN
    ring = cyl(RING_T, r_out, ring_z) - cyl(RING_T + 2, r_in, ring_z - 1)
    # V-notch at 12 o'clock, cut into the inner edge through the full thickness
    notch = Manifold.batch_hull([
        box(-0.05, r_in + NOTCH_DEPTH - 0.1, ring_z - 1, 0.05, r_in + NOTCH_DEPTH, ring_z + RING_T + 1),
        box(-NOTCH_DEPTH, r_in - 1, ring_z - 1, NOTCH_DEPTH, r_in - 0.9, ring_z + RING_T + 1),
    ])
    ring -= notch
    # grey reference recess on the camera-facing side (underside of the ring as printed)
    gx, gy = polar(r_mid, GREY_PATCH_ANGLE)
    s = GREY_PATCH / 2
    ring -= box(-s, -s, -1, s, s, GREY_PATCH_DEPTH).rotate([0, 0, GREY_PATCH_ANGLE]).translate([gx, gy, ring_z])

    struts = [cyl(STRUT_LEN + 1.0, STRUT_D / 2, SLIDER_T - 0.5, *polar(r_mid, a)) for a in STRUT_ANGLES]
    part = slider + ring
    for strut in struts:
        part += strut
    return part


def cradle():
    w2 = CRADLE_W / 2
    plate = box(-w2, -CRADLE_BELOW, 0, w2, CRADLE_ABOVE, CRADLE_T)
    plate -= box(-SLOT_W / 2, -SLOT_H / 2, -1, SLOT_W / 2, SLOT_H / 2, CRADLE_T + 1)
    # band notches in both side edges
    nx, ny = BAND_NOTCH
    for y in BAND_NOTCH_Y:
        for sx in (-1, 1):
            x_edge = sx * w2
            plate -= box(min(x_edge, x_edge - sx * nx) - 0.01, y - ny / 2, -1,
                         max(x_edge, x_edge - sx * nx) + 0.01, y + ny / 2, CRADLE_T + 1)
    # dovetail rails: the channel matches the slider plus clearance
    rail_h = SLIDER_T + CLEARANCE
    y_bottom = SLIDER_H / 2 + CLEARANCE          # channel half-width at the plate
    y_top = SLIDER_H / 2 - DOVETAIL + CLEARANCE  # channel half-width at the rail top
    eps = 0.01
    for sy in (-1, 1):
        def span(y_inner):
            lo, hi = sorted((sy * y_inner, sy * (SLIDER_H / 2 + CLEARANCE + RAIL_W)))
            return lo, hi
        b0, b1 = span(y_bottom)
        t0, t1 = span(y_top)
        rail = Manifold.batch_hull([
            box(-w2, b0, CRADLE_T - eps, w2, b1, CRADLE_T),
            box(-w2, t0, CRADLE_T + rail_h - eps, w2, t1, CRADLE_T + rail_h),
        ])
        plate += rail
    return plate


def write_stl(m, path):
    mesh = m.to_mesh()
    v = mesh.vert_properties[:, :3]
    tris = mesh.tri_verts
    with open(path, "wb") as f:
        f.write(b"SkinRing gadget".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            p, q, r = v[a], v[b], v[c]
            n = [(q[1] - p[1]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[1] - p[1]),
                 (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]),
                 (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])]
            ln = math.sqrt(sum(x * x for x in n)) or 1.0
            f.write(struct.pack("<12fH", *(x / ln for x in n), *p, *q, *r, 0))


PARTS = {"frame": frame, "cradle": cradle}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)
    for name, build in PARTS.items():
        write_stl(build(), os.path.join(out, f"{name}.stl"))
