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
            navigate('/login');
        } else {
            setShowModal(true);
        }
    }, [user, code, navigate]);

    const handleClose = () => {
        setShowModal(false);
        navigate(user?.role === 'instructor' ? '/instructor/dashboard' : '/member/dashboard');
    };

    const handleJoined = () => {
        // Modal will show success, then we navigate
        setTimeout(() => {
            navigate('/member/dashboard'); // Or sessions list
        }, 1500);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            {showModal && (
                <JoinByCodeModal 
                    type="session" 
                    onClose={handleClose}
                    onJoined={handleJoined}
                />
            )}
        </div>
    );
}
