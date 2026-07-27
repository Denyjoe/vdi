import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JoinByCodeModal from '../../components/shared/JoinByCodeModal';
import useAuthStore from '../../store/authStore';

export default function JoinSessionPage() {
    const { code } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (!user) {
            // Store intent and redirect to login
            sessionStorage.setItem('redirectAfterLogin', `/join/session/${code}`);
            navigate('/signin');
        } else {
            setShowModal(true);
        }
    }, [user, code, navigate]);

    const handleClose = () => {
        setShowModal(false);
        navigate(user?.role === 'instructor' ? '/instructor/dashboard' : '/member/dashboard');
    };

    const handleJoined = (session) => {
        // Modal will show success, then we navigate to the session
        setTimeout(() => {
            if (session?.id) {
                navigate(`/session/${session.id}`);
            } else {
                navigate('/member/dashboard'); // Fallback
            }
        }, 1500);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            {showModal && (
                <JoinByCodeModal 
                    type="session" 
                    initialCode={code}
                    onClose={handleClose}
                    onJoined={handleJoined}
                />
            )}
        </div>
    );
}
