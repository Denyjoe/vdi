import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Monitor, ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import api from '../../services/api';

export default function RegisterPage() {
    const [step, setStep] = useState(1);
    
    // Step 1: Personal Info
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('student');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Step 2: Academic Info
    const [level, setLevel] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [programmeId, setProgrammeId] = useState('');
    const [yearOfStudy, setYearOfStudy] = useState('');
    const [streamId, setStreamId] = useState('');
    const [studentId, setStudentId] = useState('');

    // Data lists
    const [departments, setDepartments] = useState([]);
    const [programmes, setProgrammes] = useState([]);
    const [streams, setStreams] = useState([]);
    
    const [loadingData, setLoadingData] = useState({
        departments: false,
        programmes: false,
        streams: false,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingData({ departments: true, programmes: true, streams: true });
                const [deptRes, progRes, streamRes] = await Promise.all([
                    api.get('/classes/departments/'),
                    api.get('/classes/programmes/'),
                    api.get('/classes/streams/')
                ]);
                
                // Assuming standard DRF list response or generic structure
                setDepartments(deptRes.data.data || deptRes.data || []);
                setProgrammes(progRes.data.data || progRes.data || []);
                
                // Streams come back grouped by department code
                const streamsData = streamRes.data.data || streamRes.data || {};
                let flatStreams = [];
                if (Array.isArray(streamsData)) {
                    flatStreams = streamsData;
                } else {
                    Object.values(streamsData).forEach(deptObj => {
                        if (deptObj.streams && Array.isArray(deptObj.streams)) {
                            flatStreams = [...flatStreams, ...deptObj.streams];
                        }
                    });
                }
                setStreams(flatStreams);
            } catch (err) {
                console.error("Failed to fetch academic data", err);
                setError("Failed to load academic data. Please refresh.");
            } finally {
                setLoadingData({ departments: false, programmes: false, streams: false });
            }
        };
        fetchData();
    }, []);

    // Derived filtered lists
    const filteredProgrammes = useMemo(() => {
        if (!level || !departmentId) return [];
        return programmes.filter(p => p.level === level && p.department === parseInt(departmentId));
    }, [programmes, level, departmentId]);

    const selectedProgramme = useMemo(() => {
        return programmes.find(p => p.id === parseInt(programmeId)) || null;
    }, [programmes, programmeId]);

    const yearOptions = useMemo(() => {
        if (!selectedProgramme) return [];
        const years = [];
        for (let i = 1; i <= selectedProgramme.duration_years; i++) {
            years.push(i);
        }
        return years;
    }, [selectedProgramme]);

    const filteredStreams = useMemo(() => {
        if (!selectedProgramme || !yearOfStudy) return [];
        return streams.filter(s => s.programme === selectedProgramme.code && s.year_of_study === parseInt(yearOfStudy));
    }, [streams, selectedProgramme, yearOfStudy]);

    const selectedDepartment = useMemo(() => {
        return departments.find(d => d.id === parseInt(departmentId)) || null;
    }, [departments, departmentId]);

    const selectedStream = useMemo(() => {
        return streams.find(s => s.id === parseInt(streamId)) || null;
    }, [streams, streamId]);

    // Handlers to reset cascades
    const handleLevelChange = (e) => {
        setLevel(e.target.value);
        setProgrammeId('');
        setYearOfStudy('');
        setStreamId('');
    };

    const handleDepartmentChange = (e) => {
        setDepartmentId(e.target.value);
        setProgrammeId('');
        setYearOfStudy('');
        setStreamId('');
    };

    const handleProgrammeChange = (e) => {
        setProgrammeId(e.target.value);
        setYearOfStudy('');
        setStreamId('');
    };

    const handleYearChange = (e) => {
        setYearOfStudy(e.target.value);
        setStreamId('');
    };

    const handleNextStep = () => {
        setError('');
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (!firstName || !lastName || !email || !password || !role) {
            setError("Please fill all required fields");
            return;
        }
        setStep(2);
    };

    const handleBack = () => {
        setStep(1);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (role === 'student') {
            if (!departmentId || !programmeId || !streamId || !yearOfStudy || !studentId) {
                setError("Please complete all academic information");
                return;
            }
        } else if (role === 'lecturer') {
            if (!departmentId) {
                setError("Please select a department");
                return;
            }
        }

        setIsLoading(true);
        try {
            const payload = {
                first_name: firstName,
                last_name: lastName,
                email,
                role,
                password,
                confirm_password: confirmPassword,
            };
            
            if (departmentId) payload.department = departmentId;
            
            if (role === 'student') {
                payload.student_id = studentId;
                payload.programme = programmeId;
                payload.stream = streamId;
                payload.year_of_study = parseInt(yearOfStudy);
            }

            const response = await api.post('/auth/register/', payload);
            
            if (response.data.success) {
                const { user, access, refresh } = response.data.data;
                login(user, access, refresh);
                
                if (user.role === 'admin') navigate('/admin/dashboard');
                else if (user.role === 'lecturer') navigate('/lecturer/dashboard');
                else navigate('/student/dashboard');
            }
        } catch (err) {
            let errorMsg = 'Failed to register. Please try again.';
            if (err.response?.data?.error) {
                const errObj = err.response.data.error;
                if (typeof errObj === 'object') {
                    const firstKey = Object.keys(errObj)[0];
                    errorMsg = `${firstKey}: ${errObj[firstKey][0]}`;
                } else {
                    errorMsg = errObj;
                }
            } else if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            }
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
                <div className="text-center mb-6">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/50">
                            <Monitor className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Join DIT VDI System</h1>
                </div>

                {/* Stepper */}
                <div className="w-full flex items-center justify-center mb-8 px-4">
                    <div className={`flex items-center ${step >= 1 ? 'text-blue-500' : 'text-slate-500'}`}>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 1 ? 'border-blue-500 bg-blue-500/20' : 'border-slate-500 bg-slate-800'}`}>
                            {step > 1 ? <Check className="w-5 h-5" /> : '1'}
                        </div>
                        <span className="ml-2 text-sm font-medium hidden sm:block">Personal</span>
                    </div>
                    <div className={`flex-1 h-0.5 mx-4 ${step >= 2 ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                    <div className={`flex items-center ${step >= 2 ? 'text-blue-500' : 'text-slate-500'}`}>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${step >= 2 ? 'border-blue-500 bg-blue-500/20' : 'border-slate-500 bg-slate-800'}`}>
                            2
                        </div>
                        <span className="ml-2 text-sm font-medium hidden sm:block">Academic</span>
                    </div>
                </div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-slate-800 py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-slate-700">
                    <form className="space-y-5" onSubmit={step === 2 ? handleSubmit : (e) => e.preventDefault()}>
                        
                        {/* STEP 1: PERSONAL INFO */}
                        {step === 1 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300" htmlFor="firstName">First Name</label>
                                        <input
                                            id="firstName" type="text" required
                                            value={firstName} onChange={(e) => setFirstName(e.target.value)}
                                            className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300" htmlFor="lastName">Last Name</label>
                                        <input
                                            id="lastName" type="text" required
                                            value={lastName} onChange={(e) => setLastName(e.target.value)}
                                            className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900 text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300" htmlFor="email">Email address</label>
                                    <input
                                        id="email" type="email" placeholder="your.email@dit.ac.tz" required
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900 text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300" htmlFor="role">Role</label>
                                    <select
                                        id="role" value={role} onChange={(e) => setRole(e.target.value)}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-slate-900 text-white"
                                    >
                                        <option value="student">Student</option>
                                        <option value="lecturer">Lecturer</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300" htmlFor="password">Password</label>
                                    <div className="mt-1 relative">
                                        <input
                                            id="password" type={showPassword ? "text" : "password"} required
                                            value={password} onChange={(e) => setPassword(e.target.value)}
                                            className="appearance-none block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900 text-white"
                                        />
                                        <button
                                            type="button" onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-slate-400 hover:text-white"
                                        >
                                            {showPassword ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300" htmlFor="confirmPassword">Confirm Password</label>
                                    <div className="mt-1 relative">
                                        <input
                                            id="confirmPassword" type={showConfirmPassword ? "text" : "password"} required
                                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="appearance-none block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900 text-white"
                                        />
                                        <button
                                            type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-slate-400 hover:text-white"
                                        >
                                            {showConfirmPassword ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-sm text-red-500 bg-red-500/10 py-2 px-3 rounded-md border border-red-500/20">{error}</div>
                                )}

                                <button
                                    type="button" onClick={handleNextStep}
                                    className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 transition-colors"
                                >
                                    Next Step <ChevronRight className="ml-2 w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* STEP 2: ACADEMIC INFO */}
                        {step === 2 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                
                                {role === 'student' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300">Academic Level</label>
                                        <select
                                            value={level} onChange={handleLevelChange} required
                                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-slate-900 text-white"
                                        >
                                            <option value="">Select Level...</option>
                                            <option value="diploma">Diploma (NTA Level 4-6)</option>
                                            <option value="bachelor">Bachelor (NTA Level 7-8)</option>
                                            <option value="master">Master (NTA Level 9)</option>
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="flex items-center text-sm font-medium text-slate-300">
                                        Department
                                        {loadingData.departments && <Loader2 className="ml-2 w-3 h-3 animate-spin text-blue-500" />}
                                    </label>
                                    <select
                                        value={departmentId} onChange={handleDepartmentChange} required
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-slate-900 text-white"
                                    >
                                        <option value="">Select Department...</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                        ))}
                                    </select>
                                </div>

                                {role === 'student' && (
                                    <>
                                        <div>
                                            <label className="flex items-center text-sm font-medium text-slate-300">
                                                Programme
                                                {loadingData.programmes && <Loader2 className="ml-2 w-3 h-3 animate-spin text-blue-500" />}
                                            </label>
                                            <select
                                                value={programmeId} onChange={handleProgrammeChange} required disabled={!level || !departmentId}
                                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-slate-900 text-white disabled:opacity-50"
                                            >
                                                <option value="">Select Programme...</option>
                                                {filteredProgrammes.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-300">Year of Study</label>
                                            <select
                                                value={yearOfStudy} onChange={handleYearChange} required disabled={!programmeId}
                                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-slate-900 text-white disabled:opacity-50"
                                            >
                                                <option value="">Select Year...</option>
                                                {yearOptions.map(y => (
                                                    <option key={y} value={y}>Year {y}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="flex items-center text-sm font-medium text-slate-300">
                                                Group / Stream
                                                {loadingData.streams && <Loader2 className="ml-2 w-3 h-3 animate-spin text-blue-500" />}
                                            </label>
                                            <select
                                                value={streamId} onChange={(e) => setStreamId(e.target.value)} required disabled={!yearOfStudy}
                                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-slate-900 text-white disabled:opacity-50"
                                            >
                                                <option value="">Select Group...</option>
                                                {filteredStreams.map(s => (
                                                    <option key={s.id} value={s.id}>{s.code} — Group {s.group_number || 1}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-300" htmlFor="studentId">
                                                DIT Registration Number
                                            </label>
                                            <input
                                                id="studentId" type="text" required placeholder="e.g. 230242498947"
                                                value={studentId} onChange={(e) => setStudentId(e.target.value)}
                                                className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-900 text-white"
                                            />
                                        </div>
                                    </>
                                )}

                                {error && (
                                    <div className="text-sm text-red-500 bg-red-500/10 py-2 px-3 rounded-md border border-red-500/20">{error}</div>
                                )}

                                <div className="flex gap-4">
                                    <button
                                        type="button" onClick={handleBack}
                                        className="flex-1 flex justify-center items-center py-2 px-4 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 hover:bg-slate-700 focus:outline-none transition-colors"
                                    >
                                        <ChevronLeft className="mr-2 w-4 h-4" /> Back
                                    </button>
                                    <button
                                        type="submit" disabled={isLoading}
                                        className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="animate-spin h-5 w-5 text-white" />
                                        ) : (
                                            "Create Account"
                                        )}
                                    </button>
                                </div>

                                {role === 'student' && selectedDepartment && selectedProgramme && streamId && (
                                    <div className="mt-6 bg-slate-900 border border-slate-700 rounded-lg p-4 animate-in fade-in zoom-in-95">
                                        <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Your Academic Profile</h3>
                                        <div className="space-y-1 text-sm text-slate-300">
                                            <p><span className="text-slate-500">Department:</span> {selectedDepartment.name}</p>
                                            <p><span className="text-slate-500">Programme:</span> {selectedProgramme.name}</p>
                                            <p><span className="text-slate-500">NTA Level:</span> {selectedProgramme.nta_range || level}</p>
                                            <p><span className="text-slate-500">Stream:</span> {selectedStream?.code}</p>
                                            <p><span className="text-slate-500">Year:</span> {yearOfStudy}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </form>

                    <div className="mt-6 text-center">
                        <Link to="/login" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                            Already have an account? Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
