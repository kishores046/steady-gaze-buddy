interface MascotProps {
  message: string;
}

const Mascot = ({ message }: MascotProps) => {
  return (
    <div className="flex items-end gap-2 animate-fade-in-up">
      <div className="text-4xl sm:text-5xl animate-float select-none">🐻</div>
      <div className="bg-card rounded-2xl rounded-bl-sm px-3 py-2 shadow-md max-w-[180px] sm:max-w-[220px]">
        <p className="text-sm sm:text-base font-bold text-foreground">{message}</p>
      </div>
    </div>
  );
};

export default Mascot;
