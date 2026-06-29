import bpy, sys

# Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import FBX
fbx_path = "/Users/blondieboi/repos/game/model/FBX/KnightCharacter.fbx"
bpy.ops.import_scene.fbx(filepath=fbx_path)

# Print hierarchy and materials
def print_obj(obj, indent=0):
    prefix = "  " * indent
    mat_info = ""
    if hasattr(obj, "data") and hasattr(obj.data, "materials"):
        mats = [m.name if m else "None" for m in obj.data.materials.values()]
        mat_info = f"  mats={mats}"
    print(f"{prefix}{obj.type} '{obj.name}'{mat_info}")
    for child in obj.children:
        print_obj(child, indent + 1)

for obj in bpy.context.scene.objects:
    if obj.parent is None:
        print_obj(obj)

print("\n--- All materials ---")
for mat in bpy.data.materials:
    print(f"  '{mat.name}'")
    if mat.node_tree:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                base = node.inputs['Base Color']
                if base.links:
                    from_node = base.links[0].from_node
                    print(f"    Base Color -> {from_node.type} '{from_node.name}'")
                    if from_node.type == 'TEX_IMAGE':
                        print(f"    Image: {from_node.image.filepath if from_node.image else 'None'}")
                else:
                    print(f"    Base Color: {list(base.default_value[:3])}")
