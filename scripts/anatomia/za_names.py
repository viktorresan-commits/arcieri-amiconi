"""nomi di Z-Anatomy -> nomi di BodyParts3D (ossa), lato .l/.r -> Left/Right"""
import re
FING = {'first': 'thumb', 'second': 'index finger', 'third': 'middle finger', 'fourth': 'ring finger', 'fifth': 'little finger'}
TOE = {'first': 'big toe', 'second': 'second toe', 'third': 'third toe', 'fourth': 'fourth toe', 'fifth': 'little toe'}
ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth']
CARP = {'Capitate bone': 'capitate', 'Hamate bone': 'hamate', 'Lunate bone': 'lunate', 'Pisiform bone': 'pisiform', 'Scaphoid bone': 'scaphoid',
        'Trapezium bone': 'trapezium', 'Trapezoid bone': 'trapezoid', 'Triquetrum bone': 'triquetral'}
def side(n):
    m = re.search(r'\.(l|r)$', n)
    return {'l': 'Left', 'r': 'Right'}[m.group(1)] if m else None
def base(n): return re.sub(r'\.(l|r|j|i|g|t|s)$', '', n).strip('()')
def za2bp_bone(n):
    s = side(n); b = base(n)
    m = re.match(r'(Distal|Middle|Proximal) phalanx of (\w+) finger of (hand|foot)$', b)
    if m and s:
        k = (FING if m.group(3) == 'hand' else TOE)[m.group(2)]
        return f'{m.group(1)} phalanx of {s.lower()} {k}'
    m = re.match(r'Vertebra ([CTL])(\d+)$', b)
    if m:
        kind = {'C': 'cervical', 'T': 'thoracic', 'L': 'lumbar'}[m.group(1)]
        return f'{ORD[int(m.group(2))]} {kind} vertebra'
    if b == 'Atlas (C1)': return 'Atlas'
    if b == 'Axis (C2)': return 'Axis'
    if b == 'Manubrium of sternum': return 'Manubrium'
    if b in ('Body of sternum', 'Sacrum', 'Mandible', 'Frontal bone', 'Occipital bone', 'Xiphoid process'): return b
    if b == 'Navicular bone' and s: return f'Navicular bone of {s.lower()} foot'
    if b in CARP and s: return f'{s} {CARP[b]}'
    if s: return f'{s} {b[0].lower() + b[1:]}'
    return b
