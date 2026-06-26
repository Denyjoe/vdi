import re

with open('apps/vms/management/commands/seed_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# We will replace _seed_programmes entirely.
new_seed_programmes = '''    def _seed_programmes(self):
        self.stdout.write('\\n── Seeding Programmes ──')

        cs = Department.objects.get(code='CS')
        ete = Department.objects.get(code='ETE')
        ee = Department.objects.get(code='EE')
        me = Department.objects.get(code='ME')
        ce = Department.objects.get(code='CE')
        slt = Department.objects.get(code='SLT')

        programmes_data = [
            # ── Civil Engineering ──
            {'department': ce, 'code': 'DIP-CVE', 'name': 'Ordinary Diploma in Civil Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ce, 'code': 'DIP-MNE', 'name': 'Ordinary Diploma in Mining Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ce, 'code': 'BENG-CVE', 'name': 'Bachelor of Civil Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': ce, 'code': 'BENG-MNE', 'name': 'Bachelor of Mining Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': ce, 'code': 'BENG-OGE', 'name': 'Bachelor of Oil and Gas Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},

            # ── Computer Studies ──
            {'department': cs, 'code': 'DIP-COE', 'name': 'Ordinary Diploma in Computer Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': cs, 'code': 'DIP-IT', 'name': 'Ordinary Diploma in Information Technology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': cs, 'code': 'DIP-MFT', 'name': 'Ordinary Diploma in Multimedia and Film Technology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': cs, 'code': 'BENG-COE', 'name': 'Bachelor of Computer Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': cs, 'code': 'BIT', 'name': 'Bachelor of Information Technology', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': cs, 'code': 'MSC-CC', 'name': 'Master in Computing and Communications', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},
            {'department': cs, 'code': 'MSC-CS', 'name': 'Master in Cyber Security', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},
            {'department': cs, 'code': 'MSC-IS', 'name': 'Master in Information Systems', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},

            # ── Electrical Engineering ──
            {'department': ee, 'code': 'DIP-EE', 'name': 'Ordinary Diploma in Electrical Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ee, 'code': 'DIP-BME', 'name': 'Ordinary Diploma in Biomedical Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ee, 'code': 'DIP-RE', 'name': 'Ordinary Diploma in Renewable Energy', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ee, 'code': 'DIP-ERE', 'name': 'Ordinary Diploma in Electrical and Renewable Energy', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ee, 'code': 'BENG-EE', 'name': 'Bachelor of Electrical Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': ee, 'code': 'BENG-BME', 'name': 'Bachelor of Biomedical Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},

            # ── Electronics & Telecom ──
            {'department': ete, 'code': 'DIP-ETE', 'name': 'Ordinary Diploma in Electronics and Telecommunications', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ete, 'code': 'DIP-CST', 'name': 'Ordinary Diploma in Communication System Technology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': ete, 'code': 'BENG-ETE', 'name': 'Bachelor of Engineering in Electronics and Telecommunications', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': ete, 'code': 'MSC-TSN', 'name': 'Master in Telecommunications Systems and Networks', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},

            # ── Mechanical Engineering ──
            {'department': me, 'code': 'DIP-ME', 'name': 'Ordinary Diploma in Mechanical Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': me, 'code': 'DIP-IAE', 'name': 'Ordinary Diploma in Industrial and Automotive Engineering', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': me, 'code': 'BENG-ME', 'name': 'Bachelor of Mechanical Engineering', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
            {'department': me, 'code': 'MSC-MM', 'name': 'Master in Maintenance Management', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},
            {'department': me, 'code': 'MSC-SEE', 'name': 'Master in Sustainable Energy Engineering', 'level': 'master', 'nta_range': 'NTA Level 9', 'duration_years': 2},

            # ── Science & Lab Tech ──
            {'department': slt, 'code': 'DIP-LT', 'name': 'Ordinary Diploma in Laboratory Technology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': slt, 'code': 'DIP-FS', 'name': 'Ordinary Diploma in Food Science', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': slt, 'code': 'DIP-BT', 'name': 'Ordinary Diploma in Biotechnology', 'level': 'diploma', 'nta_range': 'NTA Level 4-6', 'duration_years': 3},
            {'department': slt, 'code': 'BTECH-LS', 'name': 'Bachelor of Technology in Laboratory Sciences', 'level': 'bachelor', 'nta_range': 'NTA Level 7-8', 'duration_years': 4},
        ]

        programmes = {}
        for p in programmes_data:
            dept = p.pop('department')
            prog, created = Programme.objects.get_or_create(
                code=p['code'],
                defaults={**p, 'department': dept}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created programme: {p["code"]} — {p["name"]}'))
            else:
                for attr, value in p.items():
                    setattr(prog, attr, value)
                prog.department = dept
                prog.save()
                self.stdout.write(self.style.WARNING(f'  – Programme exists/updated: {p["code"]}'))
            programmes[prog.code] = prog

        return programmes'''

new_seed_course_streams = '''    def _seed_course_streams(self, programmes):
        self.stdout.write('\\n── Seeding Course Streams ──')

        cs = Department.objects.get(code='CS')
        ete = Department.objects.get(code='ETE')
        ee = Department.objects.get(code='EE')
        me = Department.objects.get(code='ME')
        ce = Department.objects.get(code='CE')
        slt = Department.objects.get(code='SLT')

        streams_data = [
            # ── COMPUTER STUDIES ──
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG22 COE-1', 'name': 'Bachelor of Computer Engineering Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG22 COE-2', 'name': 'Bachelor of Computer Engineering Year 2 Group 2', 'year_of_study': 2, 'group_number': 2},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG23 COE-1', 'name': 'Bachelor of Computer Engineering Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG23 COE-2', 'name': 'Bachelor of Computer Engineering Year 3 Group 2', 'year_of_study': 3, 'group_number': 2},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG24 COE-1', 'name': 'Bachelor of Computer Engineering Year 4 Group 1', 'year_of_study': 4, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BENG-COE'), 'code': 'BENG24 COE-2', 'name': 'Bachelor of Computer Engineering Year 4 Group 2', 'year_of_study': 4, 'group_number': 2},
            {'dept': cs, 'prog': programmes.get('BIT'), 'code': 'BIT22 IT-1', 'name': 'Bachelor of Information Technology Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BIT'), 'code': 'BIT23 IT-1', 'name': 'Bachelor of Information Technology Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('BIT'), 'code': 'BIT24 IT-1', 'name': 'Bachelor of Information Technology Year 4 Group 1', 'year_of_study': 4, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-IT'), 'code': 'ODIT1 IT-1', 'name': 'Ordinary Diploma IT Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-IT'), 'code': 'ODIT2 IT-1', 'name': 'Ordinary Diploma IT Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-IT'), 'code': 'ODIT3 IT-1', 'name': 'Ordinary Diploma IT Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-COE'), 'code': 'ODCS1 CS-1', 'name': 'Ordinary Diploma Computer Science Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-COE'), 'code': 'ODCS2 CS-1', 'name': 'Ordinary Diploma Computer Science Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-COE'), 'code': 'ODCS3 CS-1', 'name': 'Ordinary Diploma Computer Science Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': cs, 'prog': programmes.get('DIP-CST'), 'code': 'ODCST1 CST-1', 'name': 'Ordinary Diploma Communication System Technology Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── ELECTRONICS & TELECOM ──
            {'dept': ete, 'prog': programmes.get('BENG-ETE'), 'code': 'BENG22 ETE-1', 'name': 'Bachelor of Engineering Electronics & Telecom Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': ete, 'prog': programmes.get('BENG-ETE'), 'code': 'BENG23 ETE-1', 'name': 'Bachelor of Engineering Electronics & Telecom Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': ete, 'prog': programmes.get('DIP-ETE'), 'code': 'ODET1 ETE-1', 'name': 'Ordinary Diploma Electronics & Telecom Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── ELECTRICAL ENGINEERING ──
            {'dept': ee, 'prog': programmes.get('BENG-EE'), 'code': 'BENG22 EE-1', 'name': 'Bachelor of Electrical Engineering Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': ee, 'prog': programmes.get('BENG-EE'), 'code': 'BENG23 EE-1', 'name': 'Bachelor of Electrical Engineering Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': ee, 'prog': programmes.get('DIP-EE'), 'code': 'ODEE1 EE-1', 'name': 'Ordinary Diploma Electrical Engineering Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── MECHANICAL ENGINEERING ──
            {'dept': me, 'prog': programmes.get('BENG-ME'), 'code': 'BENG22 ME-1', 'name': 'Bachelor of Mechanical Engineering Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': me, 'prog': programmes.get('BENG-ME'), 'code': 'BENG23 ME-1', 'name': 'Bachelor of Mechanical Engineering Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': me, 'prog': programmes.get('DIP-ME'), 'code': 'ODME1 ME-1', 'name': 'Ordinary Diploma Mechanical Engineering Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── CIVIL ENGINEERING ──
            {'dept': ce, 'prog': programmes.get('BENG-CVE'), 'code': 'BENG22 CVE-1', 'name': 'Bachelor of Civil Engineering Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': ce, 'prog': programmes.get('BENG-CVE'), 'code': 'BENG23 CVE-1', 'name': 'Bachelor of Civil Engineering Year 3 Group 1', 'year_of_study': 3, 'group_number': 1},
            {'dept': ce, 'prog': programmes.get('DIP-CVE'), 'code': 'ODCE1 CVE-1', 'name': 'Ordinary Diploma Civil Engineering Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},

            # ── SCIENCE & LAB TECH ──
            {'dept': slt, 'prog': programmes.get('BTECH-LS'), 'code': 'BTECH22 SLT-1', 'name': 'Bachelor of Technology Laboratory Sciences Year 2 Group 1', 'year_of_study': 2, 'group_number': 1},
            {'dept': slt, 'prog': programmes.get('DIP-LT'), 'code': 'ODSLT1 SLT-1', 'name': 'Ordinary Diploma Science & Laboratory Technology Year 1 Group 1', 'year_of_study': 1, 'group_number': 1},
        ]

        for s in streams_data:
            dept = s.pop('dept')
            prog = s.pop('prog')
            stream, created = CourseStream.objects.get_or_create(
                code=s['code'],
                defaults={**s, 'department': dept, 'programme': prog}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created stream: {s["code"]}'))
            else:
                stream.programme = prog
                stream.save()
                self.stdout.write(self.style.WARNING(f'  – Stream exists/updated: {s["code"]}'))'''

content = re.sub(
    r'    def _seed_programmes\(self\):.*?    def _seed_course_streams\(self, programmes\):',
    new_seed_programmes + '\n\n' + '    def _seed_course_streams(self, programmes):',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'    def _seed_course_streams\(self, programmes\):.*?    def _seed_class\(self, created_users\):',
    new_seed_course_streams + '\n\n' + '    def _seed_class(self, created_users):',
    content,
    flags=re.DOTALL
)

# Update _seed_class to use BENG-COE instead of BCOE
content = content.replace("Programme.objects.filter(code='BCOE').first()", "Programme.objects.filter(code='BENG-COE').first()")

# Update _assign_user_profiles to use BENG-COE instead of BCOE
content = content.replace("bcoe = Programme.objects.get(code='BCOE')", "bcoe = Programme.objects.get(code='BENG-COE')")

with open('apps/vms/management/commands/seed_data.py', 'w', encoding='utf-8') as f:
    f.write(content)
