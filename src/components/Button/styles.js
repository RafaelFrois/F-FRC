import styled from 'styled-components'

export const StyledButton = styled.button `  
    width: 100%;
    padding: 12px;
    border-radius: 8px;
    border: none; //Remove borda padrão
    font-weight: bold;
    cursor: pointer; //cursor de clique

    //Define a cor baseada na variante
    background: ${props => 
        props.variant === 'secondary'
        ? '#e6db00'
        : '#e60000'
    };

    color: white;
`
