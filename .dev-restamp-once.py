# retry after terminology guard deletion handling fix
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
(root / '.github' / 'workflows' / 'dev-restamp-once.yml').unlink()
(root / '.dev-restamp-once.py').unlink()
subprocess.run(['node', 'tools/dev-assistant.mjs', 'prepare'], cwd=root, check=True)
print('---VERSION---')
print((root / 'VERSION').read_text(encoding='utf-8').strip())
print('---SITE_VERSION---')
print((root / 'site' / 'wrt' / 'data' / 'site-version.json').read_text(encoding='utf-8').strip())
print('---VERIFY---')
subprocess.run(['node', 'tools/dev-assistant.mjs', 'verify'], cwd=root, check=True)
