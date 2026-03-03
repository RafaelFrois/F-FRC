import { Container, LeftSide, RightSide, Card, Logo, Input, ButtonGroup } from './styles'
import {useState} from 'react'
import Button from '../../components/Button'
import AppHeader from '../../components/AppHeader'
import { registerUser } from '../../services/api'
import { useNavigate } from 'react-router-dom'

//Exporta o componente Register como Padrão (Default)
export default function Register(){

    const navigate = useNavigate();

    //Campos obrigatórios
    const [email, setEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    //Campos Opcionais
    const [frcNumber, setFrcNumber] = useState('');
    const [rookieYear, setRookieYear] = useState('');

    //State para mensagem de erro
    const [error, setError] = useState('');

    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    async function handleRegister() {
    //Limpa erro anterior
    setMessage('');
    setMessageType('');

    //Verifica campos obrigatórios
    if(!email || !userName || !password || !confirmPassword) {
        setMessage('Preencha todos os campos obrigatórios.');
        setMessageType('error');
        return
    }

    //Tamanho minimo da senha
    if(password.length < 8){
        setMessage('A senha deve ter no mínimo 8 caracteres.');
        setMessageType('error');
        return
    }

    //Conferir se as senhas estão iguais
    if(password !== confirmPassword){
        setMessage('As senhas não coincidem.');
        setMessageType('error');
        return
    }

    try {
        setIsLoading(true);
        
        const userData = {
            email,
            username: userName,
            password,
            frcTeamNumber: frcNumber ? parseInt(frcNumber) : undefined,
            rookieYear: rookieYear ? parseInt(rookieYear) : undefined
        };

        await registerUser(userData);

        setMessage('Cadastro realizado com sucesso! Redirecionando...');
        setMessageType('success');

        // Redireciona para login após 2 segundos
        setTimeout(() => {
            navigate('/');
        }, 2000);

    } catch (error) {
        setMessage(error.message || 'Erro ao cadastrar usuário');
        setMessageType('error');
    } finally {
        setIsLoading(false);
    }
}

    //Return define o que será renderizado na tela
    return(
        <>
            <AppHeader
                title="FANTASY - FRC"
                titleTo="/"
                rightText="CADASTRO"
                maxWidth={1200}
            />

            <Container>
                <LeftSide />

                <RightSide>
                    <Card>
                    <Logo src="/Logo-Principal-NoBG.png" alt="F-FRC Logo"/>

                    {/* Input de Email */}
                    <Input placeholder="email" value={email} onChange={e => setEmail(e.target.value)}/>

                    {/*Input de nome de usuário */}
                    <Input placeholder="nome de usuário" value={userName} onChange={e => setUserName(e.target.value)}/>

                    {/*Input de nome de senha */}
                    <Input placeholder="senha" type="password" value={password} onChange={e => setPassword(e.target.value)}/>

                    {/*Input de confirmação de senha */}
                    <Input placeholder="confirme sua senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/>

                    {/*Númeroi de time FRC */}
                    <Input placeholder="número de time FRC (opcional)" value={frcNumber} onChange={e => setFrcNumber(e.target.value)}/>

                    {/*Input de ano rookie */}
                    <Input placeholder="ano rookie (opcional)" value={rookieYear} onChange={e => setRookieYear(e.target.value)}/>

                    <ButtonGroup>

                    {message && (
                    <span
                        style={{
                        color: messageType === 'success' ? 'green' : 'red',
                        fontSize: '12px'
                    }}
                    >
                    {message}
                    </span>
)}

                        {/*Botão primario de cadastro*/}
                        <Button variant="primary" onClick={handleRegister} disabled={isLoading}>
                            {isLoading ? 'CADASTRANDO...' : 'CADASTRAR-SE'}
                        </Button>

                    </ButtonGroup>
                    </Card>
                </RightSide>
            </Container>
        </>
    )
}

