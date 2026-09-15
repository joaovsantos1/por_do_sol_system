namespace Pdv.Domain.Enums;

public enum StatusComanda
{
    Aberta = 1,
    FechamentoPendente = 2,
    Fechada = 3,
    Cancelada = 4
}

public enum TipoMovimentoEstoque
{
    Entrada = 1,
    SaidaVenda = 2,
    Ajuste = 3,
    CancelamentoVenda = 4,
    Devolucao = 5
}

public enum FormaPagamento
{
    Pix = 1,
    Dinheiro = 2,
    Cartao = 3
}

public enum PerfilUsuario
{
    Administrador = 1,
    Gerente = 2,
    Caixa = 3,
    Operador = 4
}

public enum TipoMeta
{
    Diaria = 1,
    Semanal = 2,
    Mensal = 3
}
