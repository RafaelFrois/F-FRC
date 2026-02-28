import { StyledButton } from './styles'

export default function Button({children, variant, ...rest}){
    return(
        <StyledButton variant={variant} {...rest}>
            {children}
        </StyledButton>
    )
}

