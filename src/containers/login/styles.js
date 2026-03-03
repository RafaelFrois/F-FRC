import styled from 'styled-components'

//Container principal da tela
export const Container = styled.div `
    display: flex; //coloca os filhos lado a lado
    min-height: calc(100vh - 58px);
    width: 100%; //largura total da tela

    @media (max-width: 900px) {
        flex-direction: column;
        min-height: calc(100vh - 58px);
    }
`
export const LeftSide = styled.div `
    flex: 1; //ocupa metade da tela
    background-image: url('/fotologin.webp');
    background-size: cover; //imagem cobre toda área
    background-position: center;

    @media (max-width: 900px) {
        min-height: 180px;
        flex: 0 0 180px;
    }

    @media (max-width: 640px) {
        display: none;
    }
`
export const RightSide = styled.div`
    flex: 1; //ocupa metade da tela
    background: #0066B3;
    display: flex;
    align-items: center;
    justify-content: center;

    @media (max-width: 900px) {
        padding: 24px 16px;
        min-height: calc(100vh - 238px);
    }

    @media (max-width: 640px) {
        min-height: calc(100vh - 58px);
    }
`
export const Card = styled.div`
    background: white;
    width: 380px;
    max-width: 100%;
    padding: 32px; //espaçamento interno
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px; //espaço entre os elementos

    @media (max-width: 640px) {
        width: 100%;
        padding: 24px 18px;
        border-radius: 10px;
    }
`
export const Logo = styled.img`
    width: 80px;
    margin-bottom: 16px; //espaço abaixo do logo
`
export const Input = styled.input`
    width: 100%; //ocupa toda a largura do card
    padding: 12px; //espaçamento interno
    border-radius: 8px; //bordas arredondadas
    border: 1px solid #E21C23;
    font-size: 14px;

    //Estilo do PlaceHolder
    &::placeholder{
        font-weight: bold;
        color: #ccc;
    }
`
export const ForgotPassword = styled.span`
    font-size: 12px;
    color: #E21C23;
    align-self: flex-start; //alinha a esquerda
    cursor: pointer; //cursor de clique

`
//Agrupar dois botões
export const ButtonGroup = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
`