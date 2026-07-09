with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/VMPoolPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# We need to remove the inline linkModalTemplate modal and import TemplateLinkModal.
# The inline modal starts with {/* Link to Proxmox Modal */} and ends before </div>\n  )\n}

start_idx = content.find('{/* Link to Proxmox Modal */}')
end_idx = content.find('</div>\n  )\n}', start_idx)

if start_idx != -1 and end_idx != -1:
    new_modal = '''
      <TemplateLinkModal 
        template={linkModalTemplate}
        isOpen={!!linkModalTemplate}
        onClose={() => setLinkModalTemplate(null)}
        onLinked={() => {
          setLinkModalTemplate(null);
          fetchTemplates();
          fetchPoolEntries();
        }}
      />
'''
    new_content = content[:start_idx] + new_modal + content[end_idx:]
    
    # Now we need to add the import at the top
    import_statement = "import TemplateLinkModal from '../../components/admin/TemplateLinkModal';\n"
    new_content = new_content.replace("import { \n  Server, Monitor, Code2, Shield, Settings, Play, \n  Square, Trash2, Plus, RefreshCw, AlertTriangle, CheckCircle\n} from 'lucide-react';", 
                                      "import { \n  Server, Monitor, Code2, Shield, Settings, Play, \n  Square, Trash2, Plus, RefreshCw, AlertTriangle, CheckCircle\n} from 'lucide-react';\n" + import_statement)
                                      
    with open('c:/Users/Denis Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/VMPoolPage.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Successfully updated VMPoolPage.jsx')
else:
    print('Failed to find modal boundaries')
