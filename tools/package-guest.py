import pathlib,subprocess,re,json,hashlib,shutil
root=pathlib.Path(__file__).resolve().parent.parent
source=root/'guest'; site=root/'site'
for name,path in [('kernel','kernel/kernel'),('fs.img','fs.img')]:shutil.copyfile(source/path,site/'images'/name)
subprocess.run(['gcc','-I'+str(source),str(root/'tools/layout.c'),'-o','/tmp/xv6-layout'],check=True)
(site/'layout.json').write_bytes(subprocess.check_output(['/tmp/xv6-layout']))
files={str(p.relative_to(source)):p.read_text() for folder in ['kernel','user'] for p in (source/folder).iterdir() if p.suffix in ['.c','.h','.S']}
lines=subprocess.check_output(['readelf','--debug-dump=decodedline',str(source/'kernel/kernel')],text=True)
mapping={}
for line in lines.splitlines():
 m=re.match(r'(\S+)\s+(\d+)\s+(0x[0-9a-f]+)',line)
 if m:
  path='kernel/'+m[1]
  if path in files:mapping[int(m[3],16)]=[int(m[3],16),path,int(m[2])]
symbols={}
for line in subprocess.check_output(['readelf','-s',str(source/'kernel/kernel')],text=True).splitlines():
 m=re.match(r'\s*\d+:\s+([0-9a-f]+)\s+\d+\s+(?:OBJECT|FUNC|NOTYPE)\s+\S+\s+\S+\s+\S+\s+(\S+)',line)
 if m:symbols[m[2]]='0x'+m[1]
(site/'source.json').write_text(json.dumps(dict(symbols=symbols,files=files,lines=sorted(mapping.values())),separators=(',',':')))
shutil.copyfile(source/'user/_workbench',site/'workbench/assets/user-base.elf')
manifest=json.loads((root/'docs/assets.json').read_text());manifest['guest']={'commit':'d7c0a1b7a703f7366942092f9cf421b6cd111a36','source':'guest/','changes':'user/lab.c and user/workbench.c; Makefile: lab/workbench programs, explicit RV64GC/O3 flags; workbench executable slots and separate writable kernel data slot; memlayout.h: 16 MiB guest RAM for upstream debugger compatibility'}
manifest['compiler']={'upstream':'https://github.com/lupyuen/tcc-riscv32-wasm','commit':'8cffa69ed303d80206b7cb6e6e3737506243777c','target':'riscv64','license':'LGPL-2.1-or-later','source':'site/workbench/compiler/tcc-source.tar.gz','changes':'Unmodified upstream WebAssembly binary; browser adapter and incremental ELF linker in site/workbench/'}
for path in ['site/workbench/assets/user-base.elf','site/workbench/compiler/tcc.wasm','site/workbench/compiler/tcc-source.tar.gz']:
 if not any(a['path']==path for a in manifest['assets']):manifest['assets'].append({'path':path})
for a in manifest['assets']:
 b=(root/a['path']).read_bytes();a.update(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
(root/'docs/assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
