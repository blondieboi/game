import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath="/Users/blondieboi/repos/game/model/FBX/KnightCharacter.fbx")

# Find armature
for obj in bpy.context.scene.objects:
    if obj.type == 'ARMATURE':
        print(f"Armature: {obj.name}")
        print(f"Bones:")
        for bone in obj.data.bones:
            print(f"  {bone.name} (parent: {bone.parent.name if bone.parent else 'none'})")
        break

# Print material slots on the mesh
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        print(f"\nMesh: {obj.name}")
        for i, mat in enumerate(obj.data.materials):
            print(f"  Slot {i}: {mat.name if mat else '(empty)'}")
