from load import *
import re
EXCL_M = re.compile(r"papillary|diaphragm|intercostal|sphincter|aryepiglott|arytenoid|cricothyroid|thyroarytenoid|vocalis|tongue|lingual|genioglossus|hyoglossus|styloglossus|palatoglossus|palato|uvula|tensor veli|levator veli|pharyn|constrictor|salpingo|stapedius|tensor tympani|rectus (superior|inferior|medialis|lateralis)|oblique of (left|right) eye|superior oblique|inferior oblique of|levator palpebrae|coccygeus|levator ani|pubococcygeus|iliococcygeus|puborectalis|transversus perinei|bulbospongiosus|ischiocavernosus|cremaster|detrusor|trachealis|intertransvers|rotator|interspinal|multifidus|longus colli|longus capitis|rectus capitis|obliquus capitis|scalene|transversus thoracis|subcostal|levatores costarum|serratus posterior|semispinalis|splenius|quadratus lumborum|psoas minor|ventricle|atrium|esophag|lumbrical|interosse|flexor accessorius|quadratus plantae|digiti minimi of (left|right) foot|hallucis brevis|abductor hallucis|adductor hallucis|flexor digitorum brevis|extensor digitorum brevis|plantaris|popliteus|obturator|gemellus|piriformis|quadratus femoris|pectineus|adductor (brevis|minimus)|subclavius|platysma|occipitofrontalis|temporoparietal|auricular|procerus|nasalis|depressor|levator labii|zygomaticus|risorius|orbicularis|mentalis|buccinator|corrugator|masseter|temporalis|pterygoid|digastric|stylohyoid|mylohyoid|geniohyoid|omohyoid|sternohyoid|sternothyroid|thyrohyoid", re.I)
EXCL_B = re.compile(r"tooth|gingiva|cartilage|disk|hyoid|sesamoid|ossicle|malleus|incus|stapes|ethmoid|vomer|inferior nasal concha|lacrimal|palatine|sphenoid|nasal bone|tibialis|fibularis|iliotibial|subscapularis|levator scapulae", re.I)
def classify(p):
    n=p['name']
    if p['system']=='integumentary': return 'skin' if n=='Skin' else None
    if p['system']=='muscular': return None if EXCL_M.search(n) else 'muscle'
    if p['system']=='skeletal':
        # alcuni muscoli e legamenti sono nel sistema scheletrico
        if re.search(r"tibialis|fibularis|subscapularis|levator scapulae", n, re.I): return 'muscle'
        if re.search(r"iliotibial", n, re.I): return 'muscle'
        return None if EXCL_B.search(n) else 'bone'
    if p['system']=='connective' and re.search(r"tendon|aponeurosis|retinaculum|fascia lata", n, re.I): return None
    return None
if __name__=='__main__':
    from collections import Counter
    c=Counter(); tri=Counter(); names={'muscle':[], 'bone':[]}
    for p in A['parts']:
        k=classify(p)
        if k: c[k]+=1; tri[k]+=p['indexCount']//3; names.setdefault(k,[]).append(p['name'])
    print(c, tri)
    print(sorted(set(names['muscle'])))
    print([p['name'] for p in A['parts'] if p['system']=='connective'][:40])
