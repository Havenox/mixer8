import { useEffect } from 'react';

export const useInfiniteScroll = (
  hasMore: boolean,
  isFetchingMore: boolean,
  isLoading: boolean,
  fetchMore: () => void
) => {
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.querySelector('.overflow-y-auto');
      if (!scrollContainer) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      // Dispara o fetchMore quando faltam menos de 100px para o fim do scroll
      if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !isFetchingMore && !isLoading) {
        fetchMore();
      }
    };

    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [hasMore, isFetchingMore, isLoading, fetchMore]);

  // Preenche a tela automaticamente caso a resolução do usuário seja muito alta
  // e não gere scrollbar vertical no container.
  useEffect(() => {
    if (!hasMore || isFetchingMore || isLoading) return;

    const checkAndFillPage = () => {
      const scrollContainer = document.querySelector('.overflow-y-auto');
      if (!scrollContainer) return;

      const { scrollHeight, clientHeight } = scrollContainer;
      if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) {
        fetchMore();
      }
    };

    const timer = setTimeout(checkAndFillPage, 300);
    window.addEventListener('resize', checkAndFillPage);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkAndFillPage);
    };
  }, [hasMore, isFetchingMore, isLoading, fetchMore]);
};
