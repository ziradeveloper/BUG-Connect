import re

with open(r'd:\Projects\BUGConnect\BUGConnect\src\app\layout\shell-frame\shell-frame.html', 'rb') as f:
    content = f.read()

# Replace the [title] line with [attr.aria-label]
old_line = b'                    [title]="collapsed() ? entry.label : \'\'"\r\n'
new_line = b'                    [attr.aria-label]="entry.label"\r\n'

if old_line in content:
    content = content.replace(old_line, new_line)
    with open(r'd:\Projects\BUGConnect\BUGConnect\src\app\layout\shell-frame\shell-frame.html', 'wb') as f:
        f.write(content)
    print('SUCCESS: Replaced [title] with [attr.aria-label]')
else:
    print('ERROR: target not found')
    # Show line that has [title]
    for i, line in enumerate(content.split(b'\n')):
        if b'[title]' in line:
            print(f'Line {i+1}:', repr(line))
