import Image from "next/image";

export default function OurMission() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 border border-black max-w-[95rem] w-full mx-auto">
      <div className="border-b border-black md:border-b-0 md:border-r overflow-hidden">
        <Image
          className="w-full h-full object-cover"
          src="/images/founder.jpg"
          alt="Founder of Verdictu"
          width={920}
          height={920}
          priority
        />
      </div>

      <div className="p-8 md:p-12 flex flex-col justify-center gap-6">
        <div className="flex flex-col gap-4">
          <p className="uppercase font-semibold tracking-widest text-sm">
            Our Mission
          </p>
          <h3 className="heading3-title">
            Law and clarity for everyone.
          </h3>
        </div>

        <p>
          At Verdictu, we believe that the law should be accessible to everyone.
          Our mission is to break down complex legal concepts into clear,
          understandable language — empowering individuals to navigate the legal
          landscape with confidence.
        </p>

        <p>
          We are committed to delivering independent, rigorous legal analysis
          that upholds the principles of justice, transparency, and
          accountability. Whether you are a legal professional, a student, or a
          curious citizen, Verdictu is your trusted source for law and clarity.
        </p>

        <div className="flex flex-col gap-1 pt-4 border-t border-black">
          <p className="font-semibold text-lg">Founder Name</p>
          <p>Founder &amp; Editor-in-Chief</p>
        </div>
      </div>
    </div>
  );
}
