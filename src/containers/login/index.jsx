import { Container, LeftSide, RightSide, Card, Logo, Input, ForgotPassword, ButtonGroup } from './styles'
import Button from '../../components/Button'
import AppHeader from '../../components/AppHeader'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { loginUser } from '../../services/api'

//Exporta o componente Login como Padrão (Default)
export default function Login(){

    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    async function handleLogin() {
        setMessage('');
        setMessageType('');

        // Validações
        if (!email || !password) {
            setMessage('Email e senha são obrigatórios');
            setMessageType('error');
            return;
        }

        try {
            setIsLoading(true);
            const response = await loginUser(email, password);
            
            setMessage('Login realizado com sucesso! Redirecionando...');
            setMessageType('success');

            // Redireciona para dashboard após 1.5 segundos (autenticação via cookie)
            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);

        } catch (error) {
            setMessage(error.message || 'Erro ao fazer login');
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
                rightText="LOGIN"
                maxWidth={1200}
            />

            <Container>
                <LeftSide />

                <RightSide>
                    <Card>
                    <Logo src="/Logo-Principal-NoBG.png" alt="F-FRC Logo"/>

                    {/* Input de Email */}
                    <Input 
                        placeholder="EMAIL"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleLogin()}
                    />

                    {/*Input de Senha */}
                    {/* type="password" Esconde os caracteres digitados */}
                    <Input 
                        placeholder="SENHA" 
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleLogin()}
                    />

                    {/*Texto Clicável de Esqueci Minha Senha */}
                    <ForgotPassword>
                        Esqueci minha senha
                    </ForgotPassword>

                    {message && (
                        <span
                            style={{
                                color: messageType === 'success' ? 'green' : 'red',
                                fontSize: '12px',
                                textAlign: 'center',
                                marginBottom: '10px'
                            }}
                        >
                            {message}
                        </span>
                    )}

                    <ButtonGroup>
                        {/*Botão principal de login*/}
                        <Button 
                            variant="primary"
                            onClick={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? 'ENTRANDO...' : 'ENTRAR'}
                        </Button>

                        {/*Botão secundário de cadastro*/}
                        <Button 
                            variant="secondary" 
                            onClick={() => navigate('/register')}
                            disabled={isLoading}
                        >
                            CADASTRAR-SE
                        </Button>

                    </ButtonGroup>
                    </Card>
                </RightSide>
            </Container>
        </>
    )
}

